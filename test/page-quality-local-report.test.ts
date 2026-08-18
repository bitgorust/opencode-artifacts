import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { summarizeLocalCompositionReports } from "../scripts/page-quality-local-report.ts";

const root = resolve(import.meta.dirname, "..");
const directory = join(root, "docs/evidence/page-quality/2026-08-18-local-composition");

async function reports(): Promise<Array<{ name: string; bytes: Buffer; value: unknown }>> {
  const names = (await readdir(directory)).filter((name) => /-(?:desktop|mobile)\.json$/.test(name));
  return Promise.all(names.map(async (name) => {
    const bytes = await readFile(join(directory, name));
    return { name, bytes, value: JSON.parse(bytes.toString("utf8")) as unknown };
  }));
}

test("retained local composition evidence passes every canonical browser cell", async () => {
  const summary = summarizeLocalCompositionReports(await reports());
  assert.equal(summary.cells, 16);
  assert.equal(summary.passed, 16);
  assert.equal(summary.failed, 0);
  assert.deepEqual(summary.failures, []);
  assert.ok(summary.minPrimaryVisualUtilization !== null && summary.minPrimaryVisualUtilization >= 0.5);
  assert.ok(summary.minChartFill !== null && summary.minChartFill >= 0.5);
});

test("local composition aggregation fails closed on overflow", async () => {
  const input = await reports();
  const target = input.find((report) => report.name === "dashboard-mobile.json");
  assert.ok(target);
  const changed = structuredClone(target.value) as { observations: Record<string, unknown> };
  changed.observations["documentHorizontalOverflow"] = true;
  const mutated = input.map((report) => report === target ? { ...report, value: changed } : report);
  assert.match(summarizeLocalCompositionReports(mutated).failures.join("\n"), /dashboard-mobile\.json: documentHorizontalOverflow/);
});
