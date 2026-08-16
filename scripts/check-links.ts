#!/usr/bin/env node

import { resolve } from "node:path";
import {
  collectDocumentationLinks,
  probeOfficialLinks,
  validateLocalDocumentationLinks,
} from "./documentation-links.ts";

const root = resolve(import.meta.dirname, "..");
const external = process.argv.slice(2).includes("--external");

const issues = await validateLocalDocumentationLinks(root);
for (const issue of issues) {
  console.error(
    `FAIL ${issue.sourcePath}:${issue.line} ${issue.target} [${issue.reason}] ${issue.detail}`,
  );
}
console.log(`${issues.length === 0 ? "ok" : "FAIL"} - local documentation links (${issues.length} issue(s))`);

let externalFailures = 0;
if (external) {
  const links = await collectDocumentationLinks(root);
  const results = await probeOfficialLinks(links);
  for (const result of results) {
    console.log(
      `${result.status === "pass" ? "ok" : "FAIL"} - ${result.url} [${result.status}] ${result.detail}` +
        (result.finalUrl && result.finalUrl !== result.url ? ` -> ${result.finalUrl}` : ""),
    );
  }
  externalFailures = results.filter((result) => result.status !== "pass").length;
  console.log(`${externalFailures === 0 ? "ok" : "FAIL"} - official source links (${externalFailures} failure(s))`);
} else {
  console.log("skipped - official source links (run with --external)");
}

if (issues.length > 0 || externalFailures > 0) process.exitCode = 1;
