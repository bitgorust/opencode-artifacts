import { createHash } from "node:crypto";

export const SYSTEMS = ["opencode", "claude"] as const;
export const DIMENSIONS = [
  "taskOrientation",
  "informationHierarchy",
  "compositionDensity",
  "typographyReadability",
  "visualEncoding",
  "coherenceCraft",
  "interactionQuality",
  "responsiveAdaptation",
] as const;
export const HARD_GATES = [
  "facts",
  "interactions",
  "layout",
  "composition",
  "accessibility",
  "dataHonesty",
  "offlineBudget",
] as const;

type System = typeof SYSTEMS[number];
type Dimension = typeof DIMENSIONS[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string, errors: string[]): void {
  for (const key of keys) if (!(key in value)) errors.push(`${path} is missing ${key}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${path} has unexpected field ${key}`);
}

function text(value: unknown, path: string, errors: string[], max = 500): value is string {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    errors.push(`${path} must be non-empty text of at most ${max} characters`);
    return false;
  }
  return true;
}

function sha256(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    errors.push(`${path} must be 64 lowercase hexadecimal characters`);
    return false;
  }
  return true;
}

function isoTimestamp(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO timestamp`);
    return false;
  }
  return true;
}

function manifestTaskIds(manifest: unknown): string[] {
  if (!isRecord(manifest) || !Array.isArray(manifest["taskIds"])) return [];
  return manifest["taskIds"].filter((item): item is string => typeof item === "string");
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function manifestDigest(manifest: unknown): string {
  return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

export function validateBenchmarkManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["manifest must be an object"];
  exactKeys(value, ["schemaVersion", "corpusId", "systems", "taskIds", "minimumRunsPerSystemTask", "captureModes", "hardGates", "dimensions", "thresholds"], "manifest", errors);
  if (value["schemaVersion"] !== 1) errors.push("manifest.schemaVersion must be 1");
  if (value["corpusId"] !== "page-quality-v1") errors.push("manifest.corpusId must be page-quality-v1");
  if (JSON.stringify(value["systems"]) !== JSON.stringify(SYSTEMS)) errors.push("manifest.systems must preserve the canonical systems");
  if (JSON.stringify(value["dimensions"]) !== JSON.stringify(DIMENSIONS)) errors.push("manifest.dimensions must preserve the canonical rubric");
  if (JSON.stringify(value["hardGates"]) !== JSON.stringify(HARD_GATES)) errors.push("manifest.hardGates must preserve every hard gate");
  const tasks = manifestTaskIds(value);
  if (tasks.length !== 8 || new Set(tasks).size !== 8) errors.push("manifest.taskIds must contain eight unique tasks");
  if (value["minimumRunsPerSystemTask"] !== 3) errors.push("manifest.minimumRunsPerSystemTask must be 3");
  const modes = value["captureModes"];
  if (!Array.isArray(modes) || modes.length !== 2 || !modes.every(isRecord)) {
    errors.push("manifest.captureModes must contain desktop and mobile modes");
  } else {
    const expected = [
      { id: "desktop-light", width: 1440, height: 900, colorScheme: "light" },
      { id: "mobile-dark", width: 390, height: 844, colorScheme: "dark" },
    ];
    if (JSON.stringify(modes) !== JSON.stringify(expected)) errors.push("manifest.captureModes must preserve the canonical captures");
  }
  const thresholds = value["thresholds"];
  if (!isRecord(thresholds)) errors.push("manifest.thresholds must be an object");
  else {
    exactKeys(thresholds, ["openCodeBetterOrEquivalent", "openCodeDimensionMedian", "minimumReviewers", "requiredReviewerRoles"], "manifest.thresholds", errors);
    if (thresholds["openCodeBetterOrEquivalent"] !== 0.8) errors.push("manifest parity threshold must be 0.8");
    if (thresholds["openCodeDimensionMedian"] !== 4) errors.push("manifest absolute median must be 4");
    if (thresholds["minimumReviewers"] !== 3) errors.push("manifest minimumReviewers must be 3");
    if (JSON.stringify(thresholds["requiredReviewerRoles"]) !== JSON.stringify(["design-ux", "technical"])) errors.push("manifest required reviewer roles changed");
  }
  return errors;
}

const RUN_KEYS = ["schemaVersion", "runId", "corpusId", "manifestSha256", "authorization", "generations", "reviewers", "pairs"];
const GENERATION_KEYS = ["id", "system", "taskId", "runIndex", "promptSha256", "fixtureSha256", "outputSha256", "capturedAt", "environment", "desktopCapture", "mobileCapture", "interactionTrace", "hardGates"];

export function validateBenchmarkRun(value: unknown, manifest: unknown): string[] {
  const errors = validateBenchmarkManifest(manifest).map((error) => `invalid manifest: ${error}`);
  if (!isRecord(value)) return [...errors, "run must be an object"];
  exactKeys(value, RUN_KEYS, "run", errors);
  if (value["schemaVersion"] !== 1) errors.push("run.schemaVersion must be 1");
  text(value["runId"], "run.runId", errors, 120);
  if (value["corpusId"] !== "page-quality-v1") errors.push("run.corpusId must be page-quality-v1");
  sha256(value["manifestSha256"], "run.manifestSha256", errors);
  if (typeof value["manifestSha256"] === "string" && value["manifestSha256"] !== manifestDigest(manifest)) errors.push("run.manifestSha256 does not match the canonical manifest");

  const authorization = value["authorization"];
  if (!isRecord(authorization)) errors.push("run.authorization must be an object");
  else {
    const fields = ["status", "authorizedBy", "authorizedAt", "claudeAccountScope", "modelProtocol", "retentionDisposition"];
    exactKeys(authorization, fields, "run.authorization", errors);
    if (authorization["status"] !== "pending" && authorization["status"] !== "approved") errors.push("run.authorization.status must be pending or approved");
    if (authorization["status"] === "approved") {
      text(authorization["authorizedBy"], "run.authorization.authorizedBy", errors, 120);
      isoTimestamp(authorization["authorizedAt"], "run.authorization.authorizedAt", errors);
      for (const field of ["claudeAccountScope", "modelProtocol", "retentionDisposition"]) text(authorization[field], `run.authorization.${field}`, errors);
    } else {
      for (const field of fields.slice(1)) if (authorization[field] !== null) errors.push(`run.authorization.${field} must remain null while pending`);
    }
  }

  const tasks = new Set(manifestTaskIds(manifest));
  const generationIds = new Set<string>();
  const generationsById = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(value["generations"]) || value["generations"].length > 200) errors.push("run.generations must be an array of at most 200 entries");
  else for (let index = 0; index < value["generations"].length; index++) {
    const item = value["generations"][index];
    const path = `run.generations[${index}]`;
    if (!isRecord(item)) { errors.push(`${path} must be an object`); continue; }
    exactKeys(item, GENERATION_KEYS, path, errors);
    if (text(item["id"], `${path}.id`, errors, 120)) {
      if (generationIds.has(item["id"])) errors.push(`${path}.id is duplicated`);
      generationIds.add(item["id"]);
      generationsById.set(item["id"], item);
    }
    if (!SYSTEMS.includes(String(item["system"]) as System)) errors.push(`${path}.system is invalid`);
    if (typeof item["taskId"] !== "string" || !tasks.has(item["taskId"])) errors.push(`${path}.taskId is not canonical`);
    if (!Number.isInteger(item["runIndex"]) || Number(item["runIndex"]) < 1 || Number(item["runIndex"]) > 20) errors.push(`${path}.runIndex must be an integer from 1 to 20`);
    for (const field of ["promptSha256", "fixtureSha256", "outputSha256"]) sha256(item[field], `${path}.${field}`, errors);
    isoTimestamp(item["capturedAt"], `${path}.capturedAt`, errors);
    for (const field of ["environment", "desktopCapture", "mobileCapture", "interactionTrace"]) text(item[field], `${path}.${field}`, errors, 300);
    const gates = item["hardGates"];
    if (!isRecord(gates)) errors.push(`${path}.hardGates must be an object`);
    else {
      exactKeys(gates, HARD_GATES, `${path}.hardGates`, errors);
      for (const gate of HARD_GATES) if (typeof gates[gate] !== "boolean") errors.push(`${path}.hardGates.${gate} must be boolean`);
    }
  }

  const reviewerIds = new Set<string>();
  if (!Array.isArray(value["reviewers"]) || value["reviewers"].length > 20) errors.push("run.reviewers must be an array of at most 20 entries");
  else for (let index = 0; index < value["reviewers"].length; index++) {
    const item = value["reviewers"][index];
    const path = `run.reviewers[${index}]`;
    if (!isRecord(item)) { errors.push(`${path} must be an object`); continue; }
    exactKeys(item, ["id", "roles", "independent", "conflicts", "scoresRetainedWithConsent"], path, errors);
    if (text(item["id"], `${path}.id`, errors, 80)) {
      if (!/^r-[a-z0-9]{6,}$/.test(item["id"])) errors.push(`${path}.id must be pseudonymous`);
      if (reviewerIds.has(item["id"])) errors.push(`${path}.id is duplicated`);
      reviewerIds.add(item["id"]);
    }
    if (!Array.isArray(item["roles"]) || item["roles"].length === 0 || !item["roles"].every((role) => role === "design-ux" || role === "technical" || role === "reader")) errors.push(`${path}.roles are invalid`);
    if (typeof item["independent"] !== "boolean") errors.push(`${path}.independent must be boolean`);
    if (!Array.isArray(item["conflicts"]) || !item["conflicts"].every((conflict) => typeof conflict === "string")) errors.push(`${path}.conflicts must be a string array`);
    if (typeof item["scoresRetainedWithConsent"] !== "boolean") errors.push(`${path}.scoresRetainedWithConsent must be boolean`);
  }

  const pairIds = new Set<string>();
  if (!Array.isArray(value["pairs"]) || value["pairs"].length > 100) errors.push("run.pairs must be an array of at most 100 entries");
  else for (let index = 0; index < value["pairs"].length; index++) {
    const item = value["pairs"][index];
    const path = `run.pairs[${index}]`;
    if (!isRecord(item)) { errors.push(`${path} must be an object`); continue; }
    exactKeys(item, ["id", "taskId", "runIndex", "labelA", "labelB", "generationA", "generationB", "systemA", "systemB", "randomizationSha256", "scores"], path, errors);
    if (text(item["id"], `${path}.id`, errors, 120)) {
      if (pairIds.has(item["id"])) errors.push(`${path}.id is duplicated`);
      pairIds.add(item["id"]);
    }
    if (typeof item["taskId"] !== "string" || !tasks.has(item["taskId"])) errors.push(`${path}.taskId is not canonical`);
    if (!Number.isInteger(item["runIndex"]) || Number(item["runIndex"]) < 1) errors.push(`${path}.runIndex must be positive`);
    for (const field of ["labelA", "labelB"]) if (typeof item[field] !== "string" || !/^[A-Z][0-9]{3}$/.test(item[field])) errors.push(`${path}.${field} must be a neutral blinded label`);
    if (item["labelA"] === item["labelB"]) errors.push(`${path} labels must differ`);
    for (const field of ["generationA", "generationB"]) if (typeof item[field] !== "string" || !generationIds.has(item[field])) errors.push(`${path}.${field} does not reference a generation`);
    if (!SYSTEMS.includes(String(item["systemA"]) as System) || !SYSTEMS.includes(String(item["systemB"]) as System) || item["systemA"] === item["systemB"]) errors.push(`${path} must map one generation from each system`);
    for (const side of ["A", "B"] as const) {
      const generation = typeof item[`generation${side}`] === "string" ? generationsById.get(item[`generation${side}`]) : undefined;
      if (generation !== undefined && (generation["system"] !== item[`system${side}`] || generation["taskId"] !== item["taskId"] || generation["runIndex"] !== item["runIndex"])) {
        errors.push(`${path}.generation${side} does not match its system, task, and run mapping`);
      }
    }
    sha256(item["randomizationSha256"], `${path}.randomizationSha256`, errors);
    if (!Array.isArray(item["scores"]) || item["scores"].length > 20) errors.push(`${path}.scores must be an array of at most 20 entries`);
    else {
      const scored = new Set<string>();
      for (let scoreIndex = 0; scoreIndex < item["scores"].length; scoreIndex++) {
        const score = item["scores"][scoreIndex];
        const scorePath = `${path}.scores[${scoreIndex}]`;
        if (!isRecord(score)) { errors.push(`${scorePath} must be an object`); continue; }
        exactKeys(score, ["reviewerId", "a", "b", "overall", "reason"], scorePath, errors);
        if (typeof score["reviewerId"] !== "string" || !reviewerIds.has(score["reviewerId"])) errors.push(`${scorePath}.reviewerId is unknown`);
        else if (scored.has(score["reviewerId"])) errors.push(`${scorePath}.reviewerId is duplicated in the pair`);
        else scored.add(score["reviewerId"]);
        for (const side of ["a", "b"] as const) {
          const dimensions = score[side];
          if (!isRecord(dimensions)) errors.push(`${scorePath}.${side} must be an object`);
          else {
            exactKeys(dimensions, DIMENSIONS, `${scorePath}.${side}`, errors);
            for (const dimension of DIMENSIONS) if (!Number.isInteger(dimensions[dimension]) || Number(dimensions[dimension]) < 1 || Number(dimensions[dimension]) > 5) errors.push(`${scorePath}.${side}.${dimension} must be an integer from 1 to 5`);
          }
        }
        if (score["overall"] !== "a" && score["overall"] !== "equivalent" && score["overall"] !== "b") errors.push(`${scorePath}.overall is invalid`);
        text(score["reason"], `${scorePath}.reason`, errors, 500);
      }
    }
  }
  return errors;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] ?? null : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function wilson(successes: number, total: number): { lower: number | null; upper: number | null } {
  if (total === 0) return { lower: null, upper: null };
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

export interface BenchmarkSummary {
  status: "pass" | "fail" | "incomplete";
  missing: string[];
  pairOutcomes: { openCodeBetter: number; equivalent: number; claudeBetter: number; qualifyingRate: number | null; confidence95: { lower: number | null; upper: number | null } };
  taskClaudeMajorities: string[];
  dimensionMedians: Record<Dimension, { opencode: number | null; claude: number | null }>;
  openCodeHardGateFailures: string[];
  thresholds: Record<string, boolean>;
}

export function summarizeBenchmarkRun(value: unknown, manifest: unknown): BenchmarkSummary {
  const errors = validateBenchmarkRun(value, manifest);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  if (!isRecord(value) || !Array.isArray(value["generations"]) || !Array.isArray(value["reviewers"]) || !Array.isArray(value["pairs"])) throw new Error("validated benchmark shape was lost");
  const generations = value["generations"].filter(isRecord);
  const reviewers = value["reviewers"].filter(isRecord);
  const pairs = value["pairs"].filter(isRecord);
  const tasks = manifestTaskIds(manifest);
  const missing: string[] = [];
  const authorization = value["authorization"];
  if (!isRecord(authorization) || authorization["status"] !== "approved") missing.push("authorized Claude account/settings/retention protocol");
  for (const task of tasks) for (const system of SYSTEMS) {
    const indexes = generations.filter((item) => item["taskId"] === task && item["system"] === system).map((item) => Number(item["runIndex"])).sort((a, b) => a - b);
    if (indexes.length < 3 || indexes.some((index, position) => index !== position + 1)) missing.push(`${system}/${task}: three consecutive unselected generations`);
  }
  const eligibleReviewers = reviewers.filter((item) => item["independent"] === true && item["scoresRetainedWithConsent"] === true && Array.isArray(item["conflicts"]) && item["conflicts"].length === 0);
  const roles = new Set(eligibleReviewers.flatMap((item) => Array.isArray(item["roles"]) ? item["roles"].filter((role): role is string => typeof role === "string") : []));
  if (eligibleReviewers.length < 3) missing.push("three eligible independent reviewers");
  for (const role of ["design-ux", "technical"]) if (!roles.has(role)) missing.push(`${role} reviewer role`);
  const expectedPairKeys = new Set(generations.map((item) => `${item["taskId"]}:${item["runIndex"]}`));
  const actualPairKeys = new Set(pairs.map((item) => `${item["taskId"]}:${item["runIndex"]}`));
  for (const key of expectedPairKeys) if (!actualPairKeys.has(key)) missing.push(`pair ${key}`);
  for (const pair of pairs) {
    const scores = Array.isArray(pair["scores"]) ? pair["scores"].filter(isRecord) : [];
    const scoredIds = new Set(scores.map((score) => score["reviewerId"]));
    for (const reviewer of eligibleReviewers) if (!scoredIds.has(reviewer["id"])) missing.push(`pair ${pair["id"]}: score from ${reviewer["id"]}`);
  }

  const outcomes = { openCodeBetter: 0, equivalent: 0, claudeBetter: 0 };
  const taskJudgments = new Map<string, { opencode: number; claude: number }>();
  const dimensionValues = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, { opencode: [] as number[], claude: [] as number[] }])) as Record<Dimension, { opencode: number[]; claude: number[] }>;
  for (const pair of pairs) {
    const systemA = pair["systemA"] as System;
    let openCodeVotes = 0;
    let claudeVotes = 0;
    const task = String(pair["taskId"]);
    const taskCounts = taskJudgments.get(task) ?? { opencode: 0, claude: 0 };
    for (const score of Array.isArray(pair["scores"]) ? pair["scores"].filter(isRecord) : []) {
      const overall = score["overall"];
      if (overall !== "equivalent") {
        const chosen = overall === "a" ? systemA : systemA === "opencode" ? "claude" : "opencode";
        if (chosen === "opencode") { openCodeVotes++; taskCounts.opencode++; }
        else { claudeVotes++; taskCounts.claude++; }
      }
      for (const dimension of DIMENSIONS) {
        const a = isRecord(score["a"]) ? Number(score["a"][dimension]) : Number.NaN;
        const b = isRecord(score["b"]) ? Number(score["b"][dimension]) : Number.NaN;
        if (systemA === "opencode") { dimensionValues[dimension].opencode.push(a); dimensionValues[dimension].claude.push(b); }
        else { dimensionValues[dimension].opencode.push(b); dimensionValues[dimension].claude.push(a); }
      }
    }
    taskJudgments.set(task, taskCounts);
    if (openCodeVotes > claudeVotes) outcomes.openCodeBetter++;
    else if (claudeVotes > openCodeVotes) outcomes.claudeBetter++;
    else outcomes.equivalent++;
  }
  const totalPairs = pairs.length;
  const qualifying = outcomes.openCodeBetter + outcomes.equivalent;
  const qualifyingRate = totalPairs === 0 ? null : qualifying / totalPairs;
  const taskClaudeMajorities = [...taskJudgments].filter(([, counts]) => counts.claude > counts.opencode).map(([task]) => task).sort();
  const dimensionMedians = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, { opencode: median(dimensionValues[dimension].opencode), claude: median(dimensionValues[dimension].claude) }])) as BenchmarkSummary["dimensionMedians"];
  const openCodeHardGateFailures = generations.filter((item) => item["system"] === "opencode" && isRecord(item["hardGates"]) && HARD_GATES.some((gate) => item["hardGates"][gate] !== true)).map((item) => String(item["id"]));
  const thresholds = {
    eightyPercent: qualifyingRate !== null && qualifyingRate >= 0.8,
    noTaskClaudeMajority: taskClaudeMajorities.length === 0,
    dimensionParity: DIMENSIONS.every((dimension) => dimensionMedians[dimension].opencode !== null && dimensionMedians[dimension].claude !== null && Number(dimensionMedians[dimension].opencode) >= Number(dimensionMedians[dimension].claude)),
    absoluteQuality: DIMENSIONS.every((dimension) => dimensionMedians[dimension].opencode !== null && Number(dimensionMedians[dimension].opencode) >= 4),
    hardGates: openCodeHardGateFailures.length === 0 && generations.some((item) => item["system"] === "opencode"),
  };
  const status = missing.length > 0 ? "incomplete" : Object.values(thresholds).every(Boolean) ? "pass" : "fail";
  return {
    status,
    missing: [...new Set(missing)].sort(),
    pairOutcomes: { ...outcomes, qualifyingRate, confidence95: wilson(qualifying, totalPairs) },
    taskClaudeMajorities,
    dimensionMedians,
    openCodeHardGateFailures,
    thresholds,
  };
}
