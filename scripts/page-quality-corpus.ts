#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PAGE_QUALITY_TASK_IDS = [
  "dashboard",
  "incident",
  "pr-walkthrough",
  "system-explainer",
  "compare",
  "plan-checklist",
  "findings-table",
  "interactive-decision",
] as const;

const STRESS_CASES = ["long-label", "missing-value", "dense-data", "narrow-viewport"];
const BUNDLE_KEYS = [
  "id", "task", "fixture", "fixtureSha256", "primaryReader", "readerDecision", "prompt",
  "requiredFacts", "forbiddenClaims", "sourceBundle", "interactions", "stressCases",
];
const SOURCE_KEYS = ["license", "provenance", "missingValues", "longLabel"];
const INTERACTION_KEYS = ["id", "action", "expectedState"];

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string, errors: string[]): void {
  for (const key of expected) if (!(key in value)) errors.push(`${path} is missing ${key}`);
  for (const key of Object.keys(value)) if (!expected.includes(key)) errors.push(`${path} has unexpected field ${key}`);
}

function text(value: unknown, path: string, errors: string[], min = 1): value is string {
  if (typeof value !== "string" || value.trim().length < min) {
    errors.push(`${path} must be a string of at least ${min} characters`);
    return false;
  }
  return true;
}

function stringList(value: unknown, path: string, errors: string[], min: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    errors.push(`${path} must contain at least ${min} non-empty strings`);
    return [];
  }
  return value as string[];
}

function safeRelativePath(value: string): boolean {
  return !isAbsolute(value) && value !== "" && !value.split(/[\\/]/).includes("..");
}

export interface CorpusValidation {
  schemaVersion: number | undefined;
  corpusId: string | undefined;
  bundleCount: number;
  errors: string[];
}

export async function validatePageQualityCorpus(
  repositoryRoot: string,
  corpusPath = "benchmarks/page-quality/v1/corpus.json",
): Promise<CorpusValidation> {
  const errors: string[] = [];
  const root = await realpath(repositoryRoot);
  const corpusFile = resolve(root, corpusPath);
  const corpusRelative = relative(root, corpusFile);
  if (corpusRelative === "" || corpusRelative === ".." || corpusRelative.startsWith(`..${sep}`) || isAbsolute(corpusRelative)) {
    return { schemaVersion: undefined, corpusId: undefined, bundleCount: 0, errors: ["corpus path escapes the repository"] };
  }
  let parsed: unknown;
  try {
    const bytes = await readFile(corpusFile);
    if (bytes.byteLength > 128 * 1024) errors.push("corpus exceeds the 128 KiB limit");
    parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch (error) {
    return { schemaVersion: undefined, corpusId: undefined, bundleCount: 0, errors: [`cannot read corpus: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const corpus = record(parsed);
  if (!corpus) return { schemaVersion: undefined, corpusId: undefined, bundleCount: 0, errors: ["corpus must be an object"] };
  exactKeys(corpus, ["schemaVersion", "corpusId", "license", "provenance", "captures", "bundles"], "corpus", errors);
  if (corpus["schemaVersion"] !== 1) errors.push("corpus.schemaVersion must be 1");
  if (corpus["corpusId"] !== "page-quality-v1") errors.push("corpus.corpusId must be page-quality-v1");
  if (corpus["license"] !== "CC0-1.0") errors.push("corpus.license must be CC0-1.0");
  text(corpus["provenance"], "corpus.provenance", errors, 20);
  const captures = corpus["captures"];
  if (!Array.isArray(captures) || captures.length !== 2) errors.push("corpus.captures must contain desktop and mobile");
  else {
    const expected = [{ id: "desktop", width: 1440, height: 900 }, { id: "mobile", width: 390, height: 844 }];
    if (JSON.stringify(captures) !== JSON.stringify(expected)) errors.push("corpus.captures must use the canonical viewports");
  }
  const bundles = corpus["bundles"];
  if (!Array.isArray(bundles)) {
    errors.push("corpus.bundles must be an array");
    return { schemaVersion: corpus["schemaVersion"] as number | undefined, corpusId: corpus["corpusId"] as string | undefined, bundleCount: 0, errors };
  }
  const ids: string[] = [];
  for (const [index, value] of bundles.entries()) {
    const path = `corpus.bundles[${index}]`;
    const bundle = record(value);
    if (!bundle) { errors.push(`${path} must be an object`); continue; }
    exactKeys(bundle, BUNDLE_KEYS, path, errors);
    if (text(bundle["id"], `${path}.id`, errors)) ids.push(bundle["id"]);
    for (const key of ["task", "primaryReader", "readerDecision"] as const) text(bundle[key], `${path}.${key}`, errors, 8);
    text(bundle["prompt"], `${path}.prompt`, errors, 80);
    stringList(bundle["requiredFacts"], `${path}.requiredFacts`, errors, 3);
    stringList(bundle["forbiddenClaims"], `${path}.forbiddenClaims`, errors, 2);
    const stresses = stringList(bundle["stressCases"], `${path}.stressCases`, errors, 4);
    if (JSON.stringify([...new Set(stresses)].sort()) !== JSON.stringify([...STRESS_CASES].sort())) {
      errors.push(`${path}.stressCases must contain each canonical stress case exactly once`);
    }
    const source = record(bundle["sourceBundle"]);
    if (!source) errors.push(`${path}.sourceBundle must be an object`);
    else {
      exactKeys(source, SOURCE_KEYS, `${path}.sourceBundle`, errors);
      if (source["license"] !== "CC0-1.0") errors.push(`${path}.sourceBundle.license must be CC0-1.0`);
      text(source["provenance"], `${path}.sourceBundle.provenance`, errors, 8);
      stringList(source["missingValues"], `${path}.sourceBundle.missingValues`, errors, 1);
      text(source["longLabel"], `${path}.sourceBundle.longLabel`, errors, 30);
    }
    const interactions = bundle["interactions"];
    if (!Array.isArray(interactions) || interactions.length === 0) errors.push(`${path}.interactions must not be empty`);
    else for (const [interactionIndex, interactionValue] of interactions.entries()) {
      const interactionPath = `${path}.interactions[${interactionIndex}]`;
      const interaction = record(interactionValue);
      if (!interaction) { errors.push(`${interactionPath} must be an object`); continue; }
      exactKeys(interaction, INTERACTION_KEYS, interactionPath, errors);
      for (const key of INTERACTION_KEYS) text(interaction[key], `${interactionPath}.${key}`, errors, key === "id" ? 2 : 12);
    }
    const fixture = bundle["fixture"];
    const digest = bundle["fixtureSha256"];
    if (!text(fixture, `${path}.fixture`, errors) || !safeRelativePath(fixture)) errors.push(`${path}.fixture must be a safe relative path`);
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) errors.push(`${path}.fixtureSha256 must be lowercase SHA-256`);
    if (typeof fixture === "string" && safeRelativePath(fixture)) {
      const fixturePath = resolve(root, fixture);
      const fixtureRelative = relative(root, fixturePath);
      if (fixtureRelative.startsWith(`..${sep}`) || isAbsolute(fixtureRelative)) errors.push(`${path}.fixture escapes the repository`);
      else try {
        const stat = await lstat(fixturePath);
        if (!stat.isFile() || stat.isSymbolicLink()) errors.push(`${path}.fixture must be a regular non-symlink file`);
        else {
          const bytes = await readFile(fixturePath);
          if (bytes.byteLength > 1024 * 1024) errors.push(`${path}.fixture exceeds 1 MiB`);
          const actual = createHash("sha256").update(bytes).digest("hex");
          if (actual !== digest) errors.push(`${path}.fixtureSha256 does not match ${fixture}`);
        }
      } catch (error) {
        errors.push(`${path}.fixture cannot be read: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (JSON.stringify(ids) !== JSON.stringify(PAGE_QUALITY_TASK_IDS)) errors.push("corpus bundle IDs/order must match the canonical eight-task corpus");
  if (new Set(ids).size !== ids.length) errors.push("corpus bundle IDs must be unique");
  return { schemaVersion: corpus["schemaVersion"] as number | undefined, corpusId: corpus["corpusId"] as string | undefined, bundleCount: bundles.length, errors };
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await validatePageQualityCorpus(root, process.argv[2]);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`FAIL - ${error}`);
    process.exitCode = 1;
  } else console.log(`ok - ${result.corpusId}: ${result.bundleCount} validated permission-safe bundles`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
