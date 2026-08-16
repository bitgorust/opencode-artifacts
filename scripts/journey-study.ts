#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { summarizeJourneyStudy, validateJourneyStudy } from "./journey-study-lib.ts";

const root = resolve(import.meta.dirname, "..");
const [command, input] = process.argv.slice(2);
if ((command !== "validate" && command !== "summarize") || !input) {
  console.error("Usage: npm run study -- <validate|summarize> <private-records.json>");
  process.exit(2);
}

const corpus = JSON.parse(await readFile(resolve(root, "docs/journeys/corpus.json"), "utf8")) as unknown;
const study = JSON.parse(await readFile(resolve(process.cwd(), input), "utf8")) as unknown;
const errors = validateJourneyStudy(study, corpus);
if (errors.length > 0) {
  for (const error of errors) console.error(`FAIL - ${error}`);
  process.exit(1);
}

if (command === "validate") {
  console.log("ok - journey study records are structurally valid");
} else {
  console.log(JSON.stringify(summarizeJourneyStudy(study, corpus), null, 2));
}
