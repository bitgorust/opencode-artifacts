import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginInput, ToolContext } from "@opencode-ai/plugin";
import { ArtifactsPlugin } from "../src/plugin.ts";

async function withWorktree(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "plugin-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("artifact_publish asks permission, publishes, and reports the path", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const publish = hooks.tool?.artifact_publish;
  assert.ok(publish);

  await withWorktree(async (dir) => {
    const asked: Array<Parameters<ToolContext["ask"]>[0]> = [];
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async (input) => {
        asked.push(input);
      },
    };

    const result = await publish.execute(
      { markdown: "---\ntitle: Demo Page\n---\n# Hello\n", version: true },
      ctx,
    );

    assert.equal(asked.length, 1);
    assert.equal(asked[0].permission, "artifact_publish");
    assert.match(String(result), /Artifact published to .*demo-page\.html/);

    const page = await readFile(join(dir, ".opencode", "artifacts", "demo-page.html"), "utf8");
    assert.match(page, /<h1>Hello<\/h1>/);
    assert.match(page, /artifact-footer/);

    const gallery = await readFile(join(dir, ".opencode", "artifacts", "index.html"), "utf8");
    assert.match(gallery, /Demo Page/);
  });
});
