import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { arch, cpus, platform, tmpdir, totalmem } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  compareRendererEnvironment,
  evaluateByteBudget,
  evaluateTimeBudget,
  summarizeTimings,
  type RendererEnvironment,
  type RendererWorkload,
} from "../src/performance.ts";
import { runtimeBundle, type RuntimeName } from "../src/runtime.ts";

interface WorkloadConfig {
  fixture: string;
  runtimeBundles: RuntimeName[];
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
    platform: string;
    arch: string;
    nodeMajor: number;
    cpuQuotaCores: number;
    memoryLimitBytes: number;
    browserName: string;
    browserMajor: number;
  };
  sampling: { cliSamples: number; browserSamples: number; minimumSamples: number; noiseFloorMs: number; maxRelativeP95Spread: number };
  workloads: Record<RendererWorkload, WorkloadConfig>;
}

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const configPath = resolve(process.argv[2] ?? join(root, "benchmarks", "renderer", "v1", "budgets.json"));
const reportPath = resolve(process.argv[3] ?? join(root, "docs", "evidence", "renderer", "goal-3-performance-cli-2026-08-17.json"));

async function optionalText(path: string): Promise<string | undefined> {
  try { return (await readFile(path, "utf8")).trim(); } catch { return undefined; }
}

async function environment(profile: string): Promise<RendererEnvironment & Record<string, unknown>> {
  const cpuMax = await optionalText("/sys/fs/cgroup/cpu.max");
  const [quota, period] = cpuMax?.split(/\s+/) ?? [];
  const cpuQuotaCores = quota !== undefined && quota !== "max" && period !== undefined
    ? Number(quota) / Number(period)
    : null;
  const memoryMax = await optionalText("/sys/fs/cgroup/memory.max");
  const memoryLimitBytes = memoryMax !== undefined && memoryMax !== "max" ? Number(memoryMax) : null;
  return {
    profile,
    platform: platform(),
    arch: arch(),
    nodeMajor: Number(process.versions.node.split(".")[0]),
    cpuQuotaCores,
    memoryLimitBytes,
    nodeVersion: process.version,
    cpuModel: cpus()[0]?.model ?? "unknown",
    visibleLogicalCpus: cpus().length,
    hostVisibleMemoryBytes: totalmem(),
    cgroupCpuMax: cpuMax ?? null,
    cgroupMemoryMax: memoryMax ?? null,
  };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const config = JSON.parse(await readFile(configPath, "utf8")) as BenchmarkConfig;
if (config.schemaVersion !== 1) throw new Error("renderer benchmark config schema is unsupported");
const actualEnvironment = await environment(config.profile);
const expectedEnvironment: RendererEnvironment = {
  profile: config.profile,
  platform: config.referenceEnvironment.platform,
  arch: config.referenceEnvironment.arch,
  nodeMajor: config.referenceEnvironment.nodeMajor,
  cpuQuotaCores: config.referenceEnvironment.cpuQuotaCores,
  memoryLimitBytes: config.referenceEnvironment.memoryLimitBytes,
};
const environmentComparison = compareRendererEnvironment(actualEnvironment, expectedEnvironment);
const temporary = await mkdtemp(join(tmpdir(), "renderer-cli-benchmark-"));
const workloadReports: Record<string, unknown> = {};
let passed = environmentComparison.comparable;

try {
  for (const workload of ["no-runtime", "one-chart", "multi-runtime"] as const) {
    const budget = config.workloads[workload];
    const fixturePath = resolve(dirname(configPath), budget.fixture);
    const fixture = await readFile(fixturePath, "utf8");
    const outputPath = join(temporary, `${workload}.html`);
    const samplesMs: number[] = [];
    const outputHashes = new Set<string>();
    for (let sample = 0; sample < config.sampling.cliSamples; sample++) {
      const started = process.hrtime.bigint();
      await execFileAsync(process.execPath, [join(root, "dist", "cli.js"), "render", fixturePath, "-o", outputPath], { cwd: root });
      samplesMs.push(Number(process.hrtime.bigint() - started) / 1_000_000);
      outputHashes.add(sha256(await readFile(outputPath)));
    }
    if (outputHashes.size !== 1) throw new Error(`${workload} output changed between samples`);
    const finalBytes = (await stat(outputPath)).size;
    const runtimeBytes = budget.runtimeBundles.reduce((total, name) => total + Buffer.byteLength(runtimeBundle(name), "utf8"), 0);
    const allSummary = summarizeTimings(samplesMs, config.sampling);
    const warmSummary = summarizeTimings(samplesMs.slice(1), config.sampling);
    const timeBudget = evaluateTimeBudget(allSummary, budget.cliP95Ms);
    const byteBudget = evaluateByteBudget(finalBytes, budget.warningBytes, budget.hardBytes);
    const workloadPass = timeBudget.pass && byteBudget.status !== "fail";
    passed &&= workloadPass;
    workloadReports[workload] = {
      fixture: basename(fixturePath),
      fixtureSha256: sha256(fixture),
      sourceBytes: Buffer.byteLength(fixture, "utf8"),
      coldSampleMs: samplesMs[0],
      allSamples: allSummary,
      warmSamples: warmSummary,
      timeBudget,
      bytes: {
        finalBytes,
        runtimeBytes,
        assetBytes: 0,
        shellAndContentBytes: finalBytes - runtimeBytes,
        outputSha256: [...outputHashes][0],
        budget: byteBudget,
      },
      pass: workloadPass,
    };
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  benchmark: "renderer-cli-v1",
  capturedAt: new Date().toISOString(),
  configPath: configPath.slice(root.length + 1),
  configSha256: sha256(await readFile(configPath)),
  percentileMethod: "nearest-rank",
  dependencyInstall: { includedInTiming: false, measured: false, durationMs: null, reason: "dependencies were preinstalled before the timed harness" },
  excludedSetup: ["dependency installation", "TypeScript build", "fixture discovery", "report serialization"],
  environment: actualEnvironment,
  expectedEnvironment,
  environmentComparison,
  sampling: config.sampling,
  workloads: workloadReports,
  pass: passed,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
