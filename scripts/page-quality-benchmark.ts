#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareBlindedReview, summarizeBenchmarkRun, validateBenchmarkRun } from "./page-quality-benchmark-lib.ts";

const root = resolve(import.meta.dirname, "..");
async function main(): Promise<void> {
  const [commandOrInput, ...args] = process.argv.slice(2);
  if (!commandOrInput) {
    console.error("Usage: npm run quality:benchmark -- <benchmark-run.json>\n       npm run quality:benchmark -- prepare <benchmark-run.json> <seed-file> <private-output.json> <reviewer-output.json>");
    process.exitCode = 2;
    return;
  }
  const manifest = JSON.parse(await readFile(resolve(root, "benchmarks/page-quality/v1/benchmark-manifest.json"), "utf8")) as unknown;
  if (commandOrInput === "prepare") {
    const [input, seedPath, privateOutput, reviewerOutput] = args;
    if (!input || !seedPath || !privateOutput || !reviewerOutput) {
      console.error("Usage: npm run quality:benchmark -- prepare <benchmark-run.json> <seed-file> <private-output.json> <reviewer-output.json>");
      process.exitCode = 2;
      return;
    }
    const privatePath = resolve(process.cwd(), privateOutput);
    const reviewerPath = resolve(process.cwd(), reviewerOutput);
    if (privatePath === reviewerPath) throw new Error("private and reviewer outputs must be different files");
    const run = JSON.parse(await readFile(resolve(process.cwd(), input), "utf8")) as unknown;
    const seed = await readFile(resolve(process.cwd(), seedPath));
    const prepared = prepareBlindedReview(run, manifest, seed);
    await writeFile(privatePath, `${JSON.stringify(prepared.privateRun, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try {
      await writeFile(reviewerPath, `${JSON.stringify(prepared.reviewerPacket, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    } catch (error) {
      console.error(`reviewer packet was not written; private mapping remains at ${privatePath}`);
      throw error;
    }
    console.log(JSON.stringify({ privateOutput: privatePath, reviewerOutput: reviewerPath, pairs: prepared.reviewerPacket.pairs.length }, null, 2));
    return;
  }

  const run = JSON.parse(await readFile(resolve(process.cwd(), commandOrInput), "utf8")) as unknown;
  const errors = validateBenchmarkRun(run, manifest);
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL - ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(summarizeBenchmarkRun(run, manifest), null, 2));
}

await main();
