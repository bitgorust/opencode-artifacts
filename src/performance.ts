export type RendererWorkload = "no-runtime" | "one-chart" | "multi-runtime";

export interface SamplingPolicy {
  minimumSamples: number;
  noiseFloorMs?: number;
  maxRelativeP95Spread: number;
}

export interface TimingSummary {
  samplesMs: number[];
  count: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  relativeP95Spread: number;
  disposition: "stable" | "noisy" | "insufficient" | "invalid";
  reasons: string[];
}

export interface TimeBudgetResult {
  limitMs: number;
  p95Ms: number | null;
  pass: boolean;
  reasons: string[];
}

export interface ByteBudgetResult {
  totalBytes: number;
  warningBytes: number;
  hardBytes: number;
  remainingToHardBytes: number;
  status: "pass" | "warning" | "fail";
}

export interface RendererEnvironment {
  profile: string;
  platform: string;
  arch: string;
  nodeMajor: number;
  cpuQuotaCores: number | null;
  memoryLimitBytes: number | null;
  browserName?: string;
  browserMajor?: number;
}

export interface EnvironmentComparison {
  comparable: boolean;
  mismatches: string[];
}

export interface BrowserBudgetResult {
  usefulContent: TimeBudgetResult;
  keyboardAdditional: TimeBudgetResult;
  hardFailures: string[];
  pass: boolean;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function nearestRank(samples: readonly number[], percentile: number): number {
  if (samples.length === 0) throw new Error("percentile requires at least one sample");
  if (!samples.every(finiteNonNegative)) throw new Error("samples must be finite non-negative numbers");
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1) throw new Error("percentile must be in (0, 1]");
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * percentile) - 1];
}

export function summarizeTimings(samples: readonly number[], policy: SamplingPolicy): TimingSummary {
  const values = [...samples];
  const reasons: string[] = [];
  if (!Number.isInteger(policy.minimumSamples) || policy.minimumSamples < 1) throw new Error("minimumSamples must be a positive integer");
  if (policy.noiseFloorMs !== undefined && !finiteNonNegative(policy.noiseFloorMs)) throw new Error("noiseFloorMs must be non-negative");
  if (!finiteNonNegative(policy.maxRelativeP95Spread)) throw new Error("maxRelativeP95Spread must be non-negative");
  if (!values.every(finiteNonNegative)) reasons.push("samples contain an invalid duration");
  if (values.length < policy.minimumSamples) reasons.push(`requires at least ${policy.minimumSamples} samples`);
  if (reasons.some((reason) => reason.includes("invalid")) || values.length === 0) {
    return { samplesMs: values, count: values.length, minMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0, relativeP95Spread: 0, disposition: "invalid", reasons };
  }
  const minMs = Math.min(...values);
  const maxMs = Math.max(...values);
  const p50Ms = nearestRank(values, 0.5);
  const p95Ms = nearestRank(values, 0.95);
  const relativeP95Spread = (p95Ms - p50Ms) / Math.max(p50Ms, policy.noiseFloorMs ?? 1);
  if (relativeP95Spread > policy.maxRelativeP95Spread) reasons.push(`relative p95 spread ${relativeP95Spread.toFixed(4)} exceeds ${policy.maxRelativeP95Spread}`);
  const disposition = values.length < policy.minimumSamples
    ? "insufficient"
    : reasons.length > 0 ? "noisy" : "stable";
  return { samplesMs: values, count: values.length, minMs, maxMs, p50Ms, p95Ms, relativeP95Spread, disposition, reasons };
}

export function evaluateTimeBudget(summary: TimingSummary, limitMs: number): TimeBudgetResult {
  if (!finiteNonNegative(limitMs)) throw new Error("time limit must be non-negative");
  const reasons = [...summary.reasons];
  if (summary.disposition !== "stable") reasons.push(`sample disposition is ${summary.disposition}`);
  if (summary.p95Ms > limitMs) reasons.push(`p95 ${summary.p95Ms} ms exceeds ${limitMs} ms`);
  return { limitMs, p95Ms: summary.count === 0 ? null : summary.p95Ms, pass: reasons.length === 0, reasons };
}

export function evaluateByteBudget(totalBytes: number, warningBytes: number, hardBytes: number): ByteBudgetResult {
  if (![totalBytes, warningBytes, hardBytes].every((value) => Number.isInteger(value) && value >= 0)) throw new Error("byte budgets must be non-negative integers");
  if (warningBytes > hardBytes) throw new Error("warning byte threshold cannot exceed hard threshold");
  return {
    totalBytes,
    warningBytes,
    hardBytes,
    remainingToHardBytes: Math.max(0, hardBytes - totalBytes),
    status: totalBytes > hardBytes ? "fail" : totalBytes >= warningBytes ? "warning" : "pass",
  };
}

export function compareRendererEnvironment(actual: RendererEnvironment, expected: RendererEnvironment): EnvironmentComparison {
  const mismatches: string[] = [];
  const keys: Array<keyof RendererEnvironment> = ["profile", "platform", "arch", "nodeMajor", "cpuQuotaCores", "memoryLimitBytes"];
  if (expected.browserName !== undefined) keys.push("browserName");
  if (expected.browserMajor !== undefined) keys.push("browserMajor");
  for (const key of keys) {
    if (actual[key] !== expected[key]) mismatches.push(`${key}: expected ${String(expected[key])}, observed ${String(actual[key])}`);
  }
  return { comparable: mismatches.length === 0, mismatches };
}

export function evaluateBrowserBudget(
  usefulContent: TimingSummary,
  usefulLimitMs: number,
  keyboardAdditional: TimingSummary,
  keyboardAdditionalLimitMs: number,
  hardFailures: readonly string[],
): BrowserBudgetResult {
  const usefulResult = evaluateTimeBudget(usefulContent, usefulLimitMs);
  const keyboardResult = evaluateTimeBudget(keyboardAdditional, keyboardAdditionalLimitMs);
  return {
    usefulContent: usefulResult,
    keyboardAdditional: keyboardResult,
    hardFailures: [...hardFailures],
    pass: usefulResult.pass && keyboardResult.pass && hardFailures.length === 0,
  };
}
