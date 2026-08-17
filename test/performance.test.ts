import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compareRendererEnvironment,
  evaluateBrowserBudget,
  evaluateByteBudget,
  evaluateTimeBudget,
  nearestRank,
  summarizeTimings,
  type RendererEnvironment,
} from "../src/performance.ts";
import { renderArtifact } from "../src/render.ts";

const POLICY = { minimumSamples: 5, noiseFloorMs: 1, maxRelativeP95Spread: 1 };

test("nearest-rank summaries retain samples and exact p50/p95", () => {
  assert.equal(nearestRank([5, 1, 4, 2, 3], 0.5), 3);
  assert.equal(nearestRank([5, 1, 4, 2, 3], 0.95), 5);
  const summary = summarizeTimings([100, 110, 120, 130, 140], POLICY);
  assert.equal(summary.p50Ms, 120);
  assert.equal(summary.p95Ms, 140);
  assert.equal(summary.disposition, "stable");
  assert.deepEqual(summary.samplesMs, [100, 110, 120, 130, 140]);
});

test("missing, invalid, and noisy samples cannot pass", () => {
  assert.equal(summarizeTimings([10, 11], POLICY).disposition, "insufficient");
  assert.equal(summarizeTimings([10, Number.NaN, 12, 13, 14], POLICY).disposition, "invalid");
  const noisy = summarizeTimings([10, 10, 10, 10, 100], { ...POLICY, maxRelativeP95Spread: 0.5 });
  assert.equal(noisy.disposition, "noisy");
  assert.equal(evaluateTimeBudget(noisy, 100).pass, false);
});

test("the scheduler noise floor prevents tiny fast samples from overstating relative spread", () => {
  const summary = summarizeTimings([140, 150, 160, 170, 330], { ...POLICY, noiseFloorMs: 250 });
  assert.equal(summary.disposition, "stable");
  assert.ok(summary.relativeP95Spread < 1);
});

test("time budgets accept the exact limit and fail the next unit", () => {
  const exact = summarizeTimings([2000, 2000, 2000, 2000, 2000], POLICY);
  assert.equal(evaluateTimeBudget(exact, 2000).pass, true);
  const over = summarizeTimings([2001, 2001, 2001, 2001, 2001], POLICY);
  assert.equal(evaluateTimeBudget(over, 2000).pass, false);
});

test("byte budgets distinguish pass, warning, exact hard limit, and overflow", () => {
  assert.equal(evaluateByteBudget(99, 100, 200).status, "pass");
  assert.equal(evaluateByteBudget(100, 100, 200).status, "warning");
  assert.equal(evaluateByteBudget(200, 100, 200).status, "warning");
  assert.equal(evaluateByteBudget(201, 100, 200).status, "fail");
});

test("environment mismatches make a report non-comparable", () => {
  const expected: RendererEnvironment = {
    profile: "renderer-linux-container-v1", platform: "linux", arch: "x64", nodeMajor: 24,
    cpuQuotaCores: 2, memoryLimitBytes: 4 * 1024 ** 3, browserName: "chrome", browserMajor: 151,
  };
  assert.deepEqual(compareRendererEnvironment(expected, expected), { comparable: true, mismatches: [] });
  const mismatch = compareRendererEnvironment({ ...expected, nodeMajor: 25, cpuQuotaCores: null }, expected);
  assert.equal(mismatch.comparable, false);
  assert.deepEqual(mismatch.mismatches.map((item) => item.split(":")[0]), ["nodeMajor", "cpuQuotaCores"]);
});

test("browser runtime errors and unexpected requests are hard failures, never outliers", () => {
  const useful = summarizeTimings([100, 110, 120, 130, 140], POLICY);
  const keyboard = summarizeTimings([10, 20, 30, 40, 50], POLICY);
  assert.equal(evaluateBrowserBudget(useful, 1500, keyboard, 1000, []).pass, true);
  const result = evaluateBrowserBudget(useful, 1500, keyboard, 1000, ["runtime error", "unexpected request https://example.test/x"]);
  assert.equal(result.pass, false);
  assert.equal(result.hardFailures.length, 2);
});

test("versioned workloads render within hard bytes and retained reports bind exact inputs", async () => {
  const root = resolve(import.meta.dirname, "..");
  const configPath = resolve(root, "benchmarks/renderer/v1/budgets.json");
  const configBytes = await readFile(configPath);
  const config = JSON.parse(configBytes.toString("utf8")) as {
    schemaVersion: number;
    workloads: Record<string, { fixture: string; warningBytes: number; hardBytes: number }>;
  };
  assert.equal(config.schemaVersion, 1);
  const fixtureHashes = new Map<string, string>();
  for (const [workload, budget] of Object.entries(config.workloads)) {
    const fixture = await readFile(resolve(root, "benchmarks/renderer/v1", budget.fixture));
    const rendered = renderArtifact(fixture.toString("utf8")).html;
    assert.notEqual(evaluateByteBudget(Buffer.byteLength(rendered), budget.warningBytes, budget.hardBytes).status, "fail", workload);
    fixtureHashes.set(workload, createHash("sha256").update(fixture).digest("hex"));
  }
  const configHash = createHash("sha256").update(configBytes).digest("hex");
  for (const kind of ["cli", "browser"]) {
    const report = JSON.parse(await readFile(resolve(root, `docs/evidence/renderer/goal-3-performance-${kind}-2026-08-17.json`), "utf8")) as {
      schemaVersion: number;
      configSha256: string;
      pass: boolean;
      environmentComparison: { comparable: boolean };
      workloads: Record<string, { fixtureSha256: string }>;
    };
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.configSha256, configHash);
    assert.equal(report.environmentComparison.comparable, true);
    assert.equal(report.pass, true);
    for (const [workload, expectedHash] of fixtureHashes) assert.equal(report.workloads[workload]?.fixtureSha256, expectedHash);
  }
});
