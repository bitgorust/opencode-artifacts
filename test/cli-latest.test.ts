import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { latestCommand } from "../src/cli.ts";
import { FilePublisher } from "../src/publisher.ts";

test("latest --open remains an injectable standalone reopen fallback", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-latest-"));
  try {
    const publisher = new FilePublisher(dir);
    await publisher.publish({ slug: "fallback", html: "fallback" });
    const opened: string[] = [];
    const path = await latestCommand(["--dir", dir, "--open"], (target) => { opened.push(target); });
    assert.equal(path, join(dir, "fallback.html"));
    assert.deepEqual(opened, [path]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
