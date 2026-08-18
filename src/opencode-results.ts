import type { ToolResult } from "@opencode-ai/plugin";

export const ARTIFACT_RESULT_SCHEMA_VERSION = 1;
export const MAX_TOOL_OUTPUT_BYTES = 16 * 1024;
export const MAX_TOOL_METADATA_BYTES = 8 * 1024;
export const MAX_INLINE_RESULT_CONTENT_BYTES = 8 * 1024;

export interface ArtifactResultEnvelope {
  schemaVersion: 1;
  operation: string;
  outcome: "success" | "refused" | "error";
  artifactId?: string;
  slug?: string;
  revision?: number;
  path?: string;
  url?: string;
  capability?: "portable-local" | "public-static" | "authenticated" | "connector-capable";
  visibility?: "local" | "public" | "authenticated";
  active?: boolean;
  count?: number;
  error?: string;
  nextAction?: string;
}

export type CompatibleToolResult = Exclude<ToolResult, string> & { toString(): string };

function truncateUtf8(value: string, limit: number): string {
  if (Buffer.byteLength(value, "utf8") <= limit) return value;
  const marker = "\n… [bounded result; use the exact path/operation in metadata]";
  const keep = Math.max(0, limit - Buffer.byteLength(marker, "utf8"));
  return Buffer.from(value, "utf8").subarray(0, keep).toString("utf8") + marker;
}

function boundedEnvelope(envelope: ArtifactResultEnvelope): ArtifactResultEnvelope {
  const bounded: ArtifactResultEnvelope = { ...envelope };
  bounded.operation = truncateUtf8(bounded.operation, 1024);
  if (bounded.artifactId !== undefined) bounded.artifactId = truncateUtf8(bounded.artifactId, 1024);
  if (bounded.slug !== undefined) bounded.slug = truncateUtf8(bounded.slug, 1024);
  if (bounded.path !== undefined) bounded.path = truncateUtf8(bounded.path, 1024);
  if (bounded.url !== undefined) bounded.url = truncateUtf8(bounded.url, 1024);
  if (bounded.error !== undefined) bounded.error = truncateUtf8(bounded.error, 1024);
  if (bounded.nextAction !== undefined) bounded.nextAction = truncateUtf8(bounded.nextAction, 1024);
  if (Buffer.byteLength(JSON.stringify({ artifactResult: bounded }), "utf8") > MAX_TOOL_METADATA_BYTES) {
    throw new Error("artifact result metadata exceeded its fixed byte limit");
  }
  return bounded;
}

export function artifactToolResult(
  title: string,
  output: string,
  envelope: ArtifactResultEnvelope,
): CompatibleToolResult {
  const boundedOutput = truncateUtf8(output, MAX_TOOL_OUTPUT_BYTES);
  const result = {
    title: truncateUtf8(title, 160),
    output: boundedOutput,
    metadata: { artifactResult: boundedEnvelope(envelope) },
  } as CompatibleToolResult;
  Object.defineProperty(result, "toString", {
    enumerable: false,
    value: () => boundedOutput,
  });
  return result;
}

export function artifactFailureResult(
  operation: string,
  output: string,
  error: string,
  nextAction: string,
  outcome: "refused" | "error" = "refused",
): CompatibleToolResult {
  return artifactToolResult(`Artifact ${operation} ${outcome}`, output, {
    schemaVersion: ARTIFACT_RESULT_SCHEMA_VERSION,
    operation,
    outcome,
    error,
    nextAction,
  });
}
