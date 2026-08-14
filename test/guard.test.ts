import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFindings, scanSensitive } from "../src/guard.ts";

test("clean content produces no findings", () => {
  assert.deepEqual(scanSensitive("# Report\n\nAll values here are fake."), []);
});

test("detects common credential shapes", () => {
  const cases: Array<[string, string]> = [
    ["aws key AKIAIOSFODNN7EXAMPLE", "aws-access-key"],
    ["token ghp_0123456789abcdefABCDEF0123456789", "github-token"],
    ["key sk-ant-api03-0123456789abcdef0123456789", "anthropic-key"],
    ["-----BEGIN PRIVATE KEY-----\nMII", "private-key"],
    ["Authorization: Bearer abcdef0123456789abcdef", "bearer-token"],
    ['password = "hunter2hunter2"', "password-literal"],
  ];
  for (const [content, kind] of cases) {
    const findings = scanSensitive(content);
    assert.ok(
      findings.some((f) => f.kind === kind),
      `expected ${kind} in ${JSON.stringify(content)}, got ${JSON.stringify(findings)}`,
    );
  }
});

test("formatFindings redacts the matched secret", () => {
  const findings = scanSensitive("AKIAIOSFODNN7EXAMPLE");
  const text = formatFindings(findings);
  assert.ok(text.includes("aws-access-key"));
  assert.ok(!text.includes("AKIAIOSFODNN7EXAMPLE"));
});
