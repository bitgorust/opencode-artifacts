import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPortableHtml, parsePackEntry } from "../scripts/candidate-platform-smoke.ts";

test("candidate platform pack parser requires one complete exact coordinate", () => {
  const entry = {
    filename: "opencode-artifacts-0.15.0.tgz",
    integrity: "sha512-example",
    shasum: "abc123",
    size: 10,
    unpackedSize: 20,
    entryCount: 3,
  };
  const expected = {
    filename: "opencode-artifacts-0.15.0.tgz",
    integrity: "sha512-example",
    shasum: "abc123",
    size: 10,
    unpackedSize: 20,
    entryCount: 3,
  };
  assert.deepEqual(parsePackEntry(JSON.stringify([entry])), expected);
  assert.deepEqual(parsePackEntry(JSON.stringify({ package: entry })), expected);
  assert.throws(() => parsePackEntry("[]"), /exactly one entry/);
  assert.throws(() => parsePackEntry(JSON.stringify([{ filename: "x" }])), /missing integrity/);
});

test("candidate platform output requires content and the strict offline CSP", () => {
  const html = [
    "<!doctype html>",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'none'\">",
    "<title>Renderer no-runtime benchmark</title>",
    "<p>Build results</p>",
    "<p>Benchmark interaction</p>",
  ].join("\n");
  assert.doesNotThrow(() => assertPortableHtml(html));
  assert.throws(() => assertPortableHtml(html.replace("connect-src 'none'", "connect-src https:")), /connect-src/);
});
