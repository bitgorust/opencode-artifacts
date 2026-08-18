import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARTIFACT_RESULT_SCHEMA_VERSION,
  MAX_TOOL_METADATA_BYTES,
  MAX_TOOL_OUTPUT_BYTES,
  artifactToolResult,
} from "../src/opencode-results.ts";

test("structured artifact results retain legacy text and fixed bounds", () => {
  const result = artifactToolResult("Artifact read", "x".repeat(MAX_TOOL_OUTPUT_BYTES * 2), {
    schemaVersion: ARTIFACT_RESULT_SCHEMA_VERSION,
    operation: "read",
    outcome: "success",
    artifactId: "11111111-1111-4111-8111-111111111111",
    path: `/tmp/${"p".repeat(4000)}`,
    nextAction: "inspect the pinned revision",
  });
  assert.equal(typeof result.output, "string");
  assert.equal(String(result), result.output);
  assert.ok(Buffer.byteLength(result.output, "utf8") <= MAX_TOOL_OUTPUT_BYTES);
  assert.ok(Buffer.byteLength(JSON.stringify(result.metadata), "utf8") <= MAX_TOOL_METADATA_BYTES);
  assert.equal(Object.keys(result).includes("toString"), false);
  assert.equal(result.metadata?.["artifactResult"]?.schemaVersion, 1);
});
