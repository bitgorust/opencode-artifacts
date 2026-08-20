#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { PAGE_QUALITY_TASK_IDS } from "./page-quality-corpus.ts";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export interface LocalCompositionSummary {
  schemaVersion: 1;
  corpusId: "page-quality-v1";
  cells: number;
  passed: number;
  failed: number;
  maxUsefulContentMs: number;
  maxLayoutShift: number;
  minPrimaryVisualUtilization: number | null;
  minChartFill: number | null;
  failures: string[];
  evidence: Array<{ report: string; sha256: string }>;
}

export function summarizeLocalCompositionReports(reports: Array<{ name: string; bytes: Buffer; value: unknown }>): LocalCompositionSummary {
  const failures: string[] = [];
  let maxUsefulContentMs = 0;
  let maxLayoutShift = 0;
  const visualUtilizations: number[] = [];
  const chartFills: number[] = [];
  const expected = PAGE_QUALITY_TASK_IDS.flatMap((id) => [`${id}-desktop.json`, `${id}-mobile.json`]);
  const byName = new Map(reports.map((report) => [report.name, report]));
  for (const name of expected) {
    const report = byName.get(name);
    if (!report) { failures.push(`${name}: missing report`); continue; }
    const value = record(report.value);
    const requested = record(value?.["requested"]);
    const observations = record(value?.["observations"]);
    const keyboard = record(value?.["keyboard"]);
    if (value?.["schemaVersion"] !== 1) failures.push(`${name}: schema version is not 1`);
    if (value?.["ready"] !== true) failures.push(`${name}: page did not settle`);
    const useful = value?.["usefulContentMs"];
    if (typeof useful !== "number" || !Number.isFinite(useful)) failures.push(`${name}: useful-content time is missing`);
    else maxUsefulContentMs = Math.max(maxUsefulContentMs, useful);
    const mobile = name.endsWith("-mobile.json");
    if (requested?.["width"] !== (mobile ? 390 : 1440) || requested?.["height"] !== (mobile ? 844 : 900)) failures.push(`${name}: viewport is not canonical`);
    if (requested?.["colorScheme"] !== (mobile ? "dark" : "light")) failures.push(`${name}: color mode is not canonical`);
    if (observations?.["reducedMotion"] !== mobile) failures.push(`${name}: reduced-motion observation is incorrect`);
    for (const field of ["documentHorizontalOverflow", "mainHorizontalOverflow"] as const) {
      if (observations?.[field] !== false) failures.push(`${name}: ${field}`);
    }
    for (const [field, valueList] of [["clippedText", observations?.["clippedText"]], ["renderErrors", observations?.["renderErrors"]], ["browserLogs", value?.["browserLogs"]], ["externalHttpRequests", value?.["externalHttpRequests"]]] as const) {
      if (!Array.isArray(valueList) || valueList.length !== 0) failures.push(`${name}: ${field} is not empty`);
    }
    const shift = observations?.["layoutShift"];
    if (typeof shift !== "number" || !Number.isFinite(shift)) failures.push(`${name}: layout shift is missing`);
    else { maxLayoutShift = Math.max(maxLayoutShift, shift); if (shift > 0.1) failures.push(`${name}: layout shift ${shift} exceeds 0.1`); }
    for (const sectionValue of list(observations?.["sections"])) {
      const section = record(sectionValue);
      const utilization = section?.["utilization"];
      if (typeof utilization === "number") {
        visualUtilizations.push(utilization);
        if (utilization < 0.5) failures.push(`${name}: primary visual uses only ${utilization} of its card`);
      }
    }
    for (const geometryValue of list(observations?.["chartGeometry"])) {
      const geometry = record(geometryValue);
      const width = geometry?.["width"];
      const childWidth = geometry?.["childWidth"];
      if (typeof width !== "number" || typeof childWidth !== "number" || width <= 0) failures.push(`${name}: chart geometry is invalid`);
      else {
        const fill = childWidth / width;
        chartFills.push(fill);
        if (fill < 0.5) failures.push(`${name}: chart fills only ${fill.toFixed(3)} of its container`);
      }
    }
    if (keyboard?.["firstTab"] === undefined) failures.push(`${name}: keyboard trace is missing`);
    const id = name.replace(/-(?:desktop|mobile)\.json$/, "");
    if ((id === "system-explainer" || id === "findings-table") && keyboard?.["table"] === undefined) failures.push(`${name}: table keyboard trace is missing`);
    if (id === "interactive-decision") {
      const range = record(keyboard?.["range"]);
      if (range?.["before"] === range?.["after"] || keyboard?.["copy"] !== "Copied") failures.push(`${name}: tune/copy keyboard trace failed`);
    }
    if (id === "pr-walkthrough" && keyboard?.["copy"] !== "Copied") failures.push(`${name}: verdict copy keyboard trace failed`);
  }
  const evidence = reports.filter((report) => expected.includes(report.name)).map((report) => ({
    report: report.name,
    sha256: createHash("sha256").update(report.bytes).digest("hex"),
  })).sort((a, b) => a.report.localeCompare(b.report));
  return {
    schemaVersion: 1,
    corpusId: "page-quality-v1",
    cells: expected.length,
    passed: Math.max(0, expected.length - new Set(failures.map((failure) => failure.split(":")[0])).size),
    failed: new Set(failures.map((failure) => failure.split(":")[0])).size,
    maxUsefulContentMs,
    maxLayoutShift,
    minPrimaryVisualUtilization: visualUtilizations.length === 0 ? null : Math.min(...visualUtilizations),
    minChartFill: chartFills.length === 0 ? null : Math.min(...chartFills),
    failures,
    evidence,
  };
}

async function main(): Promise<void> {
  const directory = resolve(process.argv[2] ?? "docs/evidence/page-quality/2026-08-18-local-composition");
  const output = resolve(process.argv[3] ?? `${directory}/summary.json`);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json") && name !== basename(output));
  const reports = await Promise.all(names.map(async (name) => {
    const bytes = await readFile(resolve(directory, name));
    return { name, bytes, value: JSON.parse(bytes.toString("utf8")) as unknown };
  }));
  const summary = summarizeLocalCompositionReports(reports);
  await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  if (summary.failures.length > 0) {
    for (const failure of summary.failures) console.error(`FAIL - ${failure}`);
    process.exitCode = 1;
  } else console.log(`ok - ${summary.passed}/${summary.cells} local composition browser cells passed`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
