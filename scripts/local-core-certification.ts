#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { certificationFailures, validateCertificationRecord } from "./local-core-certification-lib.ts";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run quality:certification -- <certification-record.json>");
  process.exit(2);
}
const record = JSON.parse(await readFile(resolve(process.cwd(), input), "utf8")) as unknown;
const errors = validateCertificationRecord(record);
if (errors.length > 0) {
  for (const error of errors) console.error(`FAIL - ${error}`);
  process.exit(1);
}
const failures = certificationFailures(record);
console.log(JSON.stringify({ status: failures.length === 0 ? "eligible" : "refused", failures }, null, 2));
