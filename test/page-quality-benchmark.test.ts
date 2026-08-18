import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIMENSIONS,
  HARD_GATES,
  manifestDigest,
  summarizeBenchmarkRun,
  validateBenchmarkManifest,
  validateBenchmarkRun,
} from "../scripts/page-quality-benchmark-lib.ts";

const manifest = JSON.parse(await readFile(new URL("../benchmarks/page-quality/v1/benchmark-manifest.json", import.meta.url), "utf8")) as Record<string, unknown>;
const template = JSON.parse(await readFile(new URL("../benchmarks/page-quality/v1/benchmark.template.json", import.meta.url), "utf8")) as Record<string, unknown>;
const tasks = manifest["taskIds"] as string[];

function scores(value: number): Record<string, number> {
  return Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, value]));
}

function completeRun(): Record<string, unknown> {
  const generations: Record<string, unknown>[] = [];
  const pairs: Record<string, unknown>[] = [];
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    const taskId = tasks[taskIndex] ?? "missing";
    for (let runIndex = 1; runIndex <= 3; runIndex++) {
      for (const system of ["opencode", "claude"]) {
        generations.push({
          id: `${system}-${taskId}-${runIndex}`,
          system,
          taskId,
          runIndex,
          promptSha256: "1".repeat(64),
          fixtureSha256: "2".repeat(64),
          outputSha256: (system === "opencode" ? "3" : "4").repeat(64),
          capturedAt: "2026-08-18T16:00:00Z",
          environment: `${system} recorded environment`,
          desktopCapture: `private/${system}-${taskId}-${runIndex}-desktop.png`,
          mobileCapture: `private/${system}-${taskId}-${runIndex}-mobile.png`,
          interactionTrace: `private/${system}-${taskId}-${runIndex}-interaction.json`,
          hardGates: Object.fromEntries(HARD_GATES.map((gate) => [gate, true])),
        });
      }
      const openCodeIsA = (taskIndex + runIndex) % 2 === 0;
      const systemA = openCodeIsA ? "opencode" : "claude";
      const systemB = openCodeIsA ? "claude" : "opencode";
      pairs.push({
        id: `${taskId}-${runIndex}`,
        taskId,
        runIndex,
        labelA: `A${String(taskIndex * 3 + runIndex).padStart(3, "0")}`,
        labelB: `B${String(taskIndex * 3 + runIndex).padStart(3, "0")}`,
        generationA: `${systemA}-${taskId}-${runIndex}`,
        generationB: `${systemB}-${taskId}-${runIndex}`,
        systemA,
        systemB,
        randomizationSha256: "5".repeat(64),
        scores: ["r-design01", "r-tech0001", "r-reader01"].map((reviewerId) => ({
          reviewerId,
          a: scores(openCodeIsA ? 5 : 4),
          b: scores(openCodeIsA ? 4 : 5),
          overall: openCodeIsA ? "a" : "b",
          reason: "Synthetic boundary-test score; not benchmark evidence.",
        })),
      });
    }
  }
  return {
    schemaVersion: 1,
    runId: "synthetic-boundary-test",
    corpusId: "page-quality-v1",
    manifestSha256: manifestDigest(manifest),
    authorization: {
      status: "approved",
      authorizedBy: "synthetic-test-owner",
      authorizedAt: "2026-08-18T15:00:00Z",
      claudeAccountScope: "Synthetic test only; no account was used.",
      modelProtocol: "Synthetic test protocol.",
      retentionDisposition: "Synthetic records are disposable.",
    },
    generations,
    reviewers: [
      { id: "r-design01", roles: ["design-ux"], independent: true, conflicts: [], scoresRetainedWithConsent: true },
      { id: "r-tech0001", roles: ["technical"], independent: true, conflicts: [], scoresRetainedWithConsent: true },
      { id: "r-reader01", roles: ["reader"], independent: true, conflicts: [], scoresRetainedWithConsent: true },
    ],
    pairs,
  };
}

test("canonical benchmark manifest freezes every task, mode, hard gate, rubric dimension, and threshold", () => {
  assert.deepEqual(validateBenchmarkManifest(manifest), []);
  assert.equal(manifestDigest(manifest), template["manifestSha256"]);
});

test("pending external authority and empty records remain incomplete, never pass", () => {
  assert.deepEqual(validateBenchmarkRun(template, manifest), []);
  const summary = summarizeBenchmarkRun(template, manifest);
  assert.equal(summary.status, "incomplete");
  assert.match(summary.missing.join("\n"), /authorized Claude/);
  assert.match(summary.missing.join("\n"), /three eligible independent reviewers/);
});

test("complete synthetic distributions exercise every equal-or-better threshold", () => {
  const summary = summarizeBenchmarkRun(completeRun(), manifest);
  assert.equal(summary.status, "pass");
  assert.deepEqual(summary.missing, []);
  assert.equal(summary.pairOutcomes.openCodeBetter, 24);
  assert.equal(summary.pairOutcomes.qualifyingRate, 1);
  assert.ok(Object.values(summary.thresholds).every(Boolean));
});

test("one hard-gate failure or weaker dimension fails a complete run", () => {
  const hardGate = completeRun();
  const generations = hardGate["generations"] as Record<string, unknown>[];
  const gates = generations[0]?.["hardGates"] as Record<string, unknown>;
  gates["facts"] = false;
  let summary = summarizeBenchmarkRun(hardGate, manifest);
  assert.equal(summary.status, "fail");
  assert.equal(summary.thresholds.hardGates, false);

  const weak = completeRun();
  for (const pair of weak["pairs"] as Record<string, unknown>[]) {
    const openCodeIsA = pair["systemA"] === "opencode";
    for (const score of pair["scores"] as Record<string, unknown>[]) {
      score[openCodeIsA ? "a" : "b"] = scores(3);
      score[openCodeIsA ? "b" : "a"] = scores(5);
      score["overall"] = openCodeIsA ? "b" : "a";
    }
  }
  summary = summarizeBenchmarkRun(weak, manifest);
  assert.equal(summary.status, "fail");
  assert.equal(summary.thresholds.eightyPercent, false);
  assert.equal(summary.thresholds.dimensionParity, false);
  assert.equal(summary.thresholds.absoluteQuality, false);
  assert.equal(summary.taskClaudeMajorities.length, 8);
});

test("missing runs cannot be cherry-picked and label mappings must match exact generations", () => {
  const incomplete = completeRun();
  incomplete["generations"] = (incomplete["generations"] as Record<string, unknown>[]).filter((item) => item["id"] !== "opencode-dashboard-3");
  incomplete["pairs"] = (incomplete["pairs"] as Record<string, unknown>[]).filter((item) => item["id"] !== "dashboard-3");
  const summary = summarizeBenchmarkRun(incomplete, manifest);
  assert.equal(summary.status, "incomplete");
  assert.match(summary.missing.join("\n"), /opencode\/dashboard/);

  const mismatched = completeRun();
  const pair = (mismatched["pairs"] as Record<string, unknown>[])[0];
  assert.ok(pair);
  pair["systemA"] = pair["systemA"] === "opencode" ? "claude" : "opencode";
  assert.match(validateBenchmarkRun(mismatched, manifest).join("\n"), /does not match its system, task, and run mapping/);
});
