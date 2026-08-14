import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FilePublisher, slugify } from "../src/publisher.ts";

test("slugify normalizes titles", () => {
  assert.equal(slugify("Deploy failures: Q3/Q4!"), "deploy-failures-q3-q4");
  assert.equal(slugify("  ---  "), "artifact");
  assert.equal(slugify("Incident  Response  Timeline"), "incident-response-timeline");
});

test("publish writes exact bytes to the stable path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifacts-"));
  try {
    const publisher = new FilePublisher(dir);
    const result = await publisher.publish({ slug: "report", html: "<h1>v1</h1>" });
    assert.equal(result.path, join(dir, "report.html"));
    assert.equal(result.version, 1);
    assert.equal(await readFile(result.path, "utf8"), "<h1>v1</h1>");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("versioned publish keeps history and refreshes the stable path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifacts-"));
  try {
    const publisher = new FilePublisher(dir);
    const first = await publisher.publish({ slug: "report", html: "one", version: true });
    const second = await publisher.publish({ slug: "report", html: "two", version: true });
    assert.equal(first.version, 1);
    assert.equal(second.version, 2);
    assert.equal(second.path, join(dir, "report.html"));
    assert.equal(await readFile(join(dir, "report.v1.html"), "utf8"), "one");
    assert.equal(await readFile(join(dir, "report.v2.html"), "utf8"), "two");
    assert.equal(await readFile(join(dir, "report.html"), "utf8"), "two");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
