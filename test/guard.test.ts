import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSafeDeployment,
  formatFindings,
  scanArtifactDirectory,
  scanSensitive,
} from "../src/guard.ts";

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

test("deploy scanning checks every staged file in an artifact directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guard-"));
  try {
    await writeFile(join(dir, "clean.html"), "<h1>clean</h1>");
    await writeFile(join(dir, "copied.html"), "ghp_0123456789abcdefABCDEF0123456789");
    await writeFile(join(dir, "manifest.json"), "ghp_0123456789abcdefABCDEF0123456789");
    const results = await scanArtifactDirectory(dir);
    assert.deepEqual(results.map((result) => result.file), ["copied.html", "manifest.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("deployment scanning covers provider configuration and only a targeted override bypasses it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guard-deploy-"));
  try {
    await writeFile(join(dir, "clean.html"), "<h1>clean</h1>");
    const configuration = "repository=owner/ghp_0123456789abcdefABCDEF0123456789";
    await assert.rejects(assertSafeDeployment(dir, configuration), /deploy blocked.*deployment-config/);
    await assert.doesNotReject(assertSafeDeployment(dir, configuration, true));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
