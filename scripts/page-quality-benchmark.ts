#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { summarizeBenchmarkRun, validateBenchmarkRun } from "./page-quality-benchmark-lib.ts";

const root = resolve(import.meta.dirname, "..");
const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run quality:benchmark -- <benchmark-run.json>");
  process.exit(2);
}

const manifest = JSON.parse(await readFile(resolve(root, "benchmarks/page-quality/v1/benchmark-manifest.json"), "utf8")) as unknown;
const run = JSON.parse(await readFile(resolve(process.cwd(), input), "utf8")) as unknown;
const errors = validateBenchmarkRun(run, manifest);
if (errors.length > 0) {
  for (const error of errors) console.error(`FAIL - ${error}`);
  process.exit(1);
}
console.log(JSON.stringify(summarizeBenchmarkRun(run, manifest), null, 2));
