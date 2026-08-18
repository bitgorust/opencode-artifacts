import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  compareRendererEnvironment,
  evaluateBrowserBudget,
  evaluateByteBudget,
  summarizeTimings,
  type RendererEnvironment,
  type RendererWorkload,
} from "../src/performance.ts";

interface WebDriverResponse<T> { value: T }
interface BrowserLog { level: string; message: string; timestamp: number }
interface PerformanceLog { message: string }
interface WorkloadConfig {
  fixture: string;
  runtimeBundles: string[];
  cliP95Ms: number;
  browserUsefulContentMs: number;
  browserKeyboardAdditionalMs: number;
  warningBytes: number;
  hardBytes: number;
}
interface BenchmarkConfig {
  schemaVersion: number;
  profile: string;
  referenceEnvironment: {
    platform: string; arch: string; nodeMajor: number; cpuQuotaCores: number; memoryLimitBytes: number;
    browserName: string; browserMajor: number;
  };
  sampling: { cliSamples: number; browserSamples: number; minimumSamples: number; noiseFloorMs: number; maxRelativeP95Spread: number };
  workloads: Record<RendererWorkload, WorkloadConfig>;
}

const endpoint = process.argv[2] ?? "http://127.0.0.1:4444";
const baseUrl = process.argv[3] ?? "http://127.0.0.1:4173";
const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(process.argv[4] ?? join(root, "docs", "evidence", "renderer", "goal-3-performance-browser-2026-08-17.json"));
const configPath = resolve(process.argv[5] ?? join(root, "benchmarks", "renderer", "v1", "budgets.json"));

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`WebDriver ${method} ${path} failed (${response.status}): ${responseText.slice(0, 1000)}`);
  return (JSON.parse(responseText) as WebDriverResponse<T>).value;
}

async function optionalText(path: string): Promise<string | undefined> {
  try { return (await readFile(path, "utf8")).trim(); } catch { return undefined; }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

interface BrowserSample {
  usefulContentMs: number;
  keyboardAdditionalMs: number;
  ready: boolean;
  keyboardReady: boolean;
  browserLogs: BrowserLog[];
  requestUrls: string[];
  hardFailures: string[];
}

let observedBrowserName = "";
let observedBrowserVersion = "";

async function sample(pageUrl: string, workload: RendererWorkload, width: number, height: number): Promise<BrowserSample> {
  const session = await request<{ sessionId: string; capabilities?: Record<string, unknown> }>("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        "goog:loggingPrefs": { browser: "ALL", performance: "ALL" },
        "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] },
      },
    },
  });
  const route = `/session/${session.sessionId}`;
  observedBrowserName ||= String(session.capabilities?.["browserName"] ?? "chrome");
  observedBrowserVersion ||= String(session.capabilities?.["browserVersion"] ?? "unknown");
  const hardFailures: string[] = [];
  try {
    await request("POST", `${route}/window/rect`, { width, height, x: 0, y: 0 });
    await request("POST", `${route}/goog/cdp/execute`, { cmd: "Network.enable", params: {} });
    await request("POST", `${route}/goog/cdp/execute`, {
      cmd: "Emulation.setEmulatedMedia",
      params: { media: "screen", features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }] },
    });
    const startedAt = performance.now();
    await request("POST", `${route}/url`, { url: pageUrl });
    const expectedCharts = workload === "no-runtime" ? 0 : workload === "one-chart" ? 1 : 2;
    const expectsMermaid = workload === "multi-runtime";
    const ready = await request<boolean>("POST", `${route}/execute/async`, {
        script: `const done=arguments[arguments.length-1];const started=performance.now();(function check(){
          const chartVisuals=document.querySelectorAll('.chart svg,.chart canvas').length;
          const mermaidReady=${expectsMermaid ? "!!document.querySelector('.mermaid svg, svg[id^=\"mermaid-\"]')" : "true"};
          const ready=document.readyState==='complete'&&!!document.querySelector('main')&&chartVisuals>=${expectedCharts}&&mermaidReady;
          if(ready||performance.now()-started>=12000){done(ready);return;}setTimeout(check,25);
        })();`,
        args: [],
      });
    const usefulContentMs = performance.now() - startedAt;
    if (!ready) hardFailures.push("useful-content readiness mark was missed");

    const interactionStartedAt = performance.now();
    const hasDecision = await request<boolean>("POST", `${route}/execute/sync`, {
      script: "const node=document.querySelector('.decision-opt');if(node)node.focus();return !!node;",
      args: [],
    });
    if (hasDecision) {
      await request("POST", `${route}/actions`, {
        actions: [{ type: "key", id: "keyboard", actions: [{ type: "keyDown", value: "\uE014" }, { type: "keyUp", value: "\uE014" }] }],
      });
    }
    const keyboardReady = await request<boolean>("POST", `${route}/execute/sync`, {
      script: "const node=document.activeElement;return !!node&&node.matches('.decision-opt')&&node.getAttribute('aria-checked')==='true';",
      args: [],
    });
    const keyboardAdditionalMs = performance.now() - interactionStartedAt;
    if (!keyboardReady) hardFailures.push("keyboard readiness mark was missed");

    const pageErrors = await request<string[]>("POST", `${route}/execute/sync`, {
      script: "return Array.from(document.querySelectorAll('[role=alert],.chart-error')).map((node)=>node.textContent.trim()).filter(Boolean);",
      args: [],
    });
    for (const error of pageErrors) hardFailures.push(`runtime error: ${error.slice(0, 160)}`);
    const browserLogs = await request<BrowserLog[]>("POST", `${route}/log`, { type: "browser" });
    for (const log of browserLogs) if (log.level === "SEVERE") hardFailures.push(`browser console: ${log.message.slice(0, 240)}`);
    const performanceLogs = await request<PerformanceLog[]>("POST", `${route}/log`, { type: "performance" });
    const requestUrls = performanceLogs.flatMap((entry) => {
      const parsed = JSON.parse(entry.message) as { message?: { method?: string; params?: { request?: { url?: string } } } };
      const url = parsed.message?.method === "Network.requestWillBeSent" ? parsed.message.params?.request?.url : undefined;
      return url === undefined ? [] : [url];
    });
    const origin = new URL(pageUrl).origin;
    for (const url of requestUrls) {
      if (/^https?:/i.test(url) && new URL(url).origin !== origin) hardFailures.push(`unexpected request: ${url}`);
    }
    return { usefulContentMs, keyboardAdditionalMs, ready, keyboardReady, browserLogs, requestUrls, hardFailures };
  } finally {
    await request("DELETE", route);
  }
}

const configBytes = await readFile(configPath);
const config = JSON.parse(configBytes.toString("utf8")) as BenchmarkConfig;
if (config.schemaVersion !== 1) throw new Error("renderer benchmark config schema is unsupported");
const cpuMax = await optionalText("/sys/fs/cgroup/cpu.max");
const [quota, period] = cpuMax?.split(/\s+/) ?? [];
const memoryMax = await optionalText("/sys/fs/cgroup/memory.max");
const declaredCpuQuota = process.env["RENDER_BENCH_CPU_CORES"] === undefined ? null : Number(process.env["RENDER_BENCH_CPU_CORES"]);
const declaredMemoryLimit = process.env["RENDER_BENCH_MEMORY_BYTES"] === undefined ? null : Number(process.env["RENDER_BENCH_MEMORY_BYTES"]);
const environmentBase = {
  profile: config.profile,
  platform: platform(),
  arch: arch(),
  nodeMajor: Number(process.versions.node.split(".")[0]),
  cpuQuotaCores: quota !== undefined && quota !== "max" && period !== undefined ? Number(quota) / Number(period) : declaredCpuQuota,
  memoryLimitBytes: memoryMax !== undefined && memoryMax !== "max" ? Number(memoryMax) : declaredMemoryLimit,
};
const workloadReports: Record<string, unknown> = {};

for (const workload of ["no-runtime", "one-chart", "multi-runtime"] as const) {
  const budget = config.workloads[workload];
  const slug = budget.fixture.replace(/\.md$/, "");
  const cells: Record<string, unknown> = {};
  for (const cell of [{ name: "desktop", width: 1440, height: 1200, multiplier: 1 }, { name: "mobile", width: 390, height: 844, multiplier: 2 }]) {
    const samples: BrowserSample[] = [];
    for (let index = 0; index < config.sampling.browserSamples; index++) {
      samples.push(await sample(`${baseUrl}/${slug}.html`, workload, cell.width, cell.height));
    }
    const usefulContent = summarizeTimings(samples.map((item) => item.usefulContentMs), config.sampling);
    const keyboardAdditional = summarizeTimings(samples.map((item) => item.keyboardAdditionalMs), config.sampling);
    const hardFailures = samples.flatMap((item, index) => item.hardFailures.map((failure) => `sample ${index + 1}: ${failure}`));
    const result = evaluateBrowserBudget(
      usefulContent,
      budget.browserUsefulContentMs * cell.multiplier,
      keyboardAdditional,
      budget.browserKeyboardAdditionalMs * cell.multiplier,
      hardFailures,
    );
    cells[cell.name] = {
      viewport: { width: cell.width, height: cell.height },
      usefulContent,
      keyboardAdditional,
      budget: result,
      samples,
      pass: result.pass,
    };
  }
  const fixturePath = resolve(dirname(configPath), budget.fixture);
  const fixture = await readFile(fixturePath);
  const pageBytes = await readFile(resolve(process.argv[6] ?? join(root, ".benchmark-artifacts"), `${slug}.html`));
  workloadReports[workload] = {
    fixture: budget.fixture,
    fixtureSha256: sha256(fixture),
    finalBytes: pageBytes.length,
    byteBudget: evaluateByteBudget(pageBytes.length, budget.warningBytes, budget.hardBytes),
    cells,
  };
}

const actualEnvironment: RendererEnvironment = {
  ...environmentBase,
  browserName: observedBrowserName,
  browserMajor: Number(observedBrowserVersion.split(".")[0]),
};
const expectedEnvironment: RendererEnvironment = {
  profile: config.profile,
  platform: config.referenceEnvironment.platform,
  arch: config.referenceEnvironment.arch,
  nodeMajor: config.referenceEnvironment.nodeMajor,
  cpuQuotaCores: config.referenceEnvironment.cpuQuotaCores,
  memoryLimitBytes: config.referenceEnvironment.memoryLimitBytes,
  browserName: config.referenceEnvironment.browserName,
  browserMajor: config.referenceEnvironment.browserMajor,
};
const environmentComparison = compareRendererEnvironment(actualEnvironment, expectedEnvironment);
const workloadPass = Object.values(workloadReports).every((value) => {
  const report = value as { byteBudget: { status: string }; cells: Record<string, { pass: boolean }> };
  return report.byteBudget.status !== "fail" && Object.values(report.cells).every((cell) => cell.pass);
});
const report = {
  schemaVersion: 1,
  benchmark: "renderer-browser-v1",
  capturedAt: new Date().toISOString(),
  configPath: configPath.slice(root.length + 1),
  configSha256: sha256(configBytes),
  percentileMethod: "nearest-rank",
  navigationState: "new WebDriver session and browser profile for every cold sample",
  excludedSetup: ["Selenium container start", "artifact rendering", "local server start", "session creation before navigation", "report serialization"],
  environment: {
    ...actualEnvironment,
    browserVersion: observedBrowserVersion,
    cgroupCpuMax: cpuMax ?? null,
    cgroupMemoryMax: memoryMax ?? null,
    constraintSource: cpuMax !== undefined && memoryMax !== undefined ? "cgroup observation" : "explicit Docker constraints; verify retained docker inspect values",
  },
  expectedEnvironment,
  environmentComparison,
  sampling: config.sampling,
  workloads: workloadReports,
  pass: environmentComparison.comparable && workloadPass,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
