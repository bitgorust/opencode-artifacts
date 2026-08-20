#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface WebDriverResponse<T> { value: T }

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export interface BrowserRequest {
  browserName: "chrome" | "firefox" | "safari";
  browserVersion?: string;
  platformName?: string;
  headless: boolean;
}

function assertSafeExtraCapabilities(value: unknown, path = "extra capabilities"): asserts value is Record<string, unknown> {
  const detail = record(value);
  if (!detail) throw new Error(`${path} must be an object`);
  for (const [key, item] of Object.entries(detail)) {
    if (/(?:access.?key|api.?key|token|secret|password|credential|username)/i.test(key)) {
      throw new Error(`${path}.${key} looks credential-bearing; put provider authentication in WEBDRIVER_ENDPOINT`);
    }
    if (record(item)) assertSafeExtraCapabilities(item, `${path}.${key}`);
    else if (Array.isArray(item)) {
      for (let index = 0; index < item.length; index++) if (record(item[index])) {
        assertSafeExtraCapabilities(item[index], `${path}.${key}[${index}]`);
      }
    }
  }
}

export function buildWebDriverCapabilities(
  request: BrowserRequest,
  extraCapabilities: Record<string, unknown> = {},
): Record<string, unknown> {
  if (request.headless && request.browserName === "safari") {
    throw new Error("Safari does not expose a standard headless WebDriver mode");
  }
  assertSafeExtraCapabilities(extraCapabilities);
  for (const key of ["browserName", "browserVersion", "platformName", "acceptInsecureCerts", "goog:chromeOptions", "moz:firefoxOptions"]) {
    if (key in extraCapabilities) throw new Error(`extra capabilities cannot override ${key}`);
  }
  const alwaysMatch: Record<string, unknown> = {
    ...extraCapabilities,
    browserName: request.browserName,
    acceptInsecureCerts: false,
  };
  if (request.browserVersion !== undefined) alwaysMatch["browserVersion"] = request.browserVersion;
  if (request.platformName !== undefined) alwaysMatch["platformName"] = request.platformName;
  if (request.headless && request.browserName === "chrome") {
    alwaysMatch["goog:chromeOptions"] = { args: ["--headless=new", "--disable-dev-shm-usage"] };
  }
  if (request.headless && request.browserName === "firefox") {
    alwaysMatch["moz:firefoxOptions"] = { args: ["-headless"] };
  }
  return { capabilities: { alwaysMatch } };
}

export function redactedTarget(value: string): string {
  const url = new URL(value);
  if (url.protocol === "data:" || url.protocol === "blob:") return `${url.protocol}<redacted>`;
  if (url.protocol === "file:") return "file://<redacted>";
  url.username = "";
  url.password = "";
  if (url.search !== "") url.search = "?redacted";
  url.hash = "";
  return url.href;
}

export function supportBrowserFailures(value: unknown): string[] {
  const failures: string[] = [];
  const report = record(value);
  if (!report) return ["report must be an object"];
  if (report["schemaVersion"] !== 1) failures.push("schemaVersion must be 1");
  if (report["ready"] !== true) failures.push("page did not settle");
  const observations = record(report["observations"]);
  if (!observations) failures.push("observations are missing");
  else {
    for (const field of ["documentHorizontalOverflow", "mainHorizontalOverflow"] as const) {
      if (observations[field] !== false) failures.push(field);
    }
    for (const field of ["clippedText", "renderErrors"] as const) {
      if (!Array.isArray(observations[field]) || observations[field].length !== 0) failures.push(`${field} is not empty`);
    }
  }
  const keyboard = record(report["keyboard"]);
  if (!keyboard || !record(keyboard["firstTab"])) failures.push("first keyboard target is missing");
  if (!Array.isArray(report["externalHttpRequests"]) || report["externalHttpRequests"].length !== 0) {
    failures.push("externalHttpRequests is not empty");
  }
  const screenshot = record(report["screenshot"]);
  if (!screenshot || typeof screenshot["sha256"] !== "string" || !/^[a-f0-9]{64}$/.test(screenshot["sha256"])) {
    failures.push("screenshot digest is missing");
  }
  return failures;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function absent(path: string): Promise<void> {
  try {
    await lstat(path);
    throw new Error(`refusing to overwrite evidence file ${path}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

async function main(): Promise<void> {
  const endpoint = process.env["WEBDRIVER_ENDPOINT"] ?? "http://127.0.0.1:4444";
  const pageUrl = argument("--url");
  const reportPath = argument("--report");
  const screenshotPath = argument("--screenshot");
  const browserName = argument("--browser");
  const browserVersion = argument("--browser-version");
  const platformName = argument("--platform");
  const width = Number(argument("--width"));
  const height = Number(argument("--height"));
  const headless = process.argv.includes("--headless");
  if (!pageUrl || !reportPath || !screenshotPath ||
      (browserName !== "chrome" && browserName !== "firefox" && browserName !== "safari") ||
      !Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 480) {
    throw new Error("usage: support-browser-smoke --url <page> --report <report.json> --screenshot <page.png> --browser <chrome|firefox|safari> --width <n> --height <n> [--browser-version <version>] [--platform <name>] [--headless]");
  }
  const resolvedReport = resolve(reportPath);
  const resolvedScreenshot = resolve(screenshotPath);
  await absent(resolvedReport);
  await absent(resolvedScreenshot);
  let extraCapabilities: Record<string, unknown> = {};
  const extraCapabilitiesPath = process.env["WEBDRIVER_CAPABILITIES_FILE"];
  if (extraCapabilitiesPath !== undefined) {
    const bytes = await readFile(resolve(extraCapabilitiesPath));
    if (bytes.byteLength > 64 * 1024) throw new Error("WebDriver capabilities file exceeds 64 KiB");
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    assertSafeExtraCapabilities(parsed);
    extraCapabilities = parsed;
  }
  const base = endpoint.replace(/\/$/, "");
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`WebDriver ${method} ${path} failed (${response.status}): ${responseText.slice(0, 1000)}`);
    return (JSON.parse(responseText) as WebDriverResponse<T>).value;
  }

  const session = await request<{ sessionId: string; capabilities?: Record<string, unknown> }>(
    "POST",
    "/session",
    buildWebDriverCapabilities({ browserName, browserVersion, platformName, headless }, extraCapabilities),
  );
  const route = `/session/${session.sessionId}`;
  async function script<T>(source: string): Promise<T> {
    return request<T>("POST", `${route}/execute/sync`, { script: source, args: [] });
  }
  async function key(value: string): Promise<void> {
    await request("POST", `${route}/actions`, { actions: [{
      type: "key", id: "keyboard", actions: [{ type: "keyDown", value }, { type: "keyUp", value }],
    }] });
  }
  async function focus(selector: string): Promise<boolean> {
    return script<boolean>(`const n=document.querySelector(${JSON.stringify(selector)});if(n)n.focus();return !!n;`);
  }

  try {
    await request("POST", `${route}/window/rect`, { width, height, x: 0, y: 0 });
    const startedAt = Date.now();
    await request("POST", `${route}/url`, { url: pageUrl });
    let ready = false;
    for (let attempt = 0; attempt < 160; attempt++) {
      ready = await script<boolean>("return document.readyState==='complete'&&!document.querySelector('.component[data-component-index]')&&Array.from(document.querySelectorAll('.chart')).every(n=>n.querySelector('canvas,svg'))&&Array.from(document.querySelectorAll('pre.mermaid')).every(n=>n.querySelector('svg'));");
      if (ready) break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    const usefulContentMs = Date.now() - startedAt;
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    await script("document.activeElement&&document.activeElement.blur();return true;");
    await key("\uE004");
    const keyboard: Record<string, unknown> = {
      firstTab: await script("return {tag:document.activeElement?.tagName||null,className:document.activeElement?.className||null,text:document.activeElement?.textContent?.trim()||null};"),
    };
    if (await focus(".decision-opt")) {
      await key("\uE014");
      keyboard["decision"] = await script("const n=document.querySelector('.decision-opt[aria-checked=\"true\"]');return {selected:n?.dataset.option||null,active:document.activeElement?.dataset.option||null};");
    }
    if (await focus(".th-sort")) {
      await key("\uE007");
      keyboard["table"] = await script("const n=document.querySelector('th[aria-sort]:not([aria-sort=\"none\"])');return {direction:n?.getAttribute('aria-sort')||null,label:n?.textContent?.trim()||null};");
    }
    if (await focus('input[type="range"]')) {
      const before = await script<string>("return document.activeElement?.value||'';");
      await key("\uE014");
      const after = await script<string>("return document.activeElement?.value||'';");
      keyboard["range"] = { before, after };
    }
    if (await focus(".copy-btn")) {
      await key("\uE007");
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      keyboard["copy"] = await script("return document.querySelector('.copy-note')?.textContent?.trim()||'';");
    }
    const observations = await script<Record<string, unknown>>(`
      const main=document.querySelector('main');
      return {
        documentHorizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
        mainHorizontalOverflow:!!main&&main.scrollWidth>main.clientWidth,
        clippedText:Array.from(document.querySelectorAll('h1,h2,h3,.stat-label,.finding-title,.pill,.decision-label,figcaption,th,td')).flatMap((node)=>{const style=getComputedStyle(node);return node.scrollWidth>node.clientWidth+1&&style.overflow!=='visible'?[node.textContent?.trim()?.slice(0,120)||node.tagName]:[];}),
        renderErrors:Array.from(document.querySelectorAll('.chart-error,.asset-error')).map((node)=>node.textContent?.trim()),
        headings:Array.from(document.querySelectorAll('h1,h2,h3')).map((node)=>node.textContent?.trim()),
        landmarks:{header:document.querySelectorAll('header').length,main:document.querySelectorAll('main').length,footer:document.querySelectorAll('footer').length},
        interactive:{buttons:document.querySelectorAll('button').length,ranges:document.querySelectorAll('input[type="range"]').length,radios:document.querySelectorAll('[role="radio"]').length},
        resourceUrls:performance.getEntriesByType('resource').map((entry)=>entry.name),
        userAgent:navigator.userAgent
      };
    `);
    const screenshotBytes = Buffer.from(await request<string>("GET", `${route}/screenshot`), "base64");
    const resourceUrls = Array.isArray(observations["resourceUrls"])
      ? observations["resourceUrls"].filter((item): item is string => typeof item === "string")
      : [];
    const pageOrigin = new URL(pageUrl).origin;
    const externalHttpRequests = resourceUrls.filter((url) => /^https?:/i.test(url) && new URL(url).origin !== pageOrigin).map(redactedTarget);
    const safeCapabilities = {
      browserName: session.capabilities?.["browserName"] ?? browserName,
      browserVersion: session.capabilities?.["browserVersion"] ?? browserVersion ?? "provider-selected",
      platformName: session.capabilities?.["platformName"] ?? platformName ?? "provider-selected",
    };
    const report: Record<string, unknown> = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      result: "pending-assessment",
      request: { browserName, browserVersion: browserVersion ?? null, platformName: platformName ?? null, width, height, headless },
      environment: safeCapabilities,
      target: redactedTarget(pageUrl),
      ready,
      usefulContentMs,
      keyboard,
      observations: { ...observations, resourceUrls: resourceUrls.map(redactedTarget) },
      externalHttpRequests,
      screenshot: { path: screenshotPath, sha256: createHash("sha256").update(screenshotBytes).digest("hex") },
      limitations: [
        "Standard WebDriver does not provide a portable accessibility tree or console-log endpoint.",
        "This automated observation is not a support claim and requires the declared manual, assistive-technology, and human first-use evidence.",
      ],
    };
    const failures = supportBrowserFailures(report);
    report["result"] = failures.length === 0 ? "pass" : "fail";
    report["failures"] = failures;
    await writeFile(resolvedScreenshot, screenshotBytes, { flag: "wx", mode: 0o600 });
    await writeFile(resolvedReport, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (failures.length > 0) {
      for (const failure of failures) console.error(`FAIL - ${failure}`);
      process.exitCode = 1;
    } else console.log(`ok - ${browserName} portable-page browser smoke passed`);
  } finally {
    await request("DELETE", route);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
