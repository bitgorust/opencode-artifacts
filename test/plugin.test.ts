import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

test("artifact_publish asks permission, publishes, and reports the path", async () => {  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
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
    assert.match(page, /<h1 id="hello">Hello<\/h1>/);
    assert.match(page, /artifact-footer/);

    const gallery = await readFile(join(dir, ".opencode", "artifacts", "index.html"), "utf8");
    assert.match(gallery, /Demo Page/);
  });
});

test("artifact_publish blocks credential-looking content unless forced", async () => {  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const publish = hooks.tool?.artifact_publish;
  assert.ok(publish);

  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };

    const blocked = await publish.execute(
      { markdown: "# Leak\n\ntoken ghp_0123456789abcdefABCDEF0123456789\n" },
      ctx,
    );
    assert.match(String(blocked), /Publish blocked/);

    const forced = await publish.execute(
      { markdown: "# Leak\n\ntoken ghp_0123456789abcdefABCDEF0123456789\n", force: true },
      ctx,
    );
    assert.match(String(forced), /Artifact published to/);
  });
});

test("artifact_publish scans a title override for sensitive content", async () => {
  const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
  assert.ok(publish);
  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };
    const result = await publish.execute(
      { markdown: "# Clean", title: "ghp_0123456789abcdefABCDEF0123456789" },
      ctx,
    );
    assert.match(String(result), /Publish blocked/);
  });
});

test("proactive option injects the guidance into the system transform", async () => {
  const off = await ArtifactsPlugin({} as unknown as PluginInput);
  assert.equal(off["experimental.chat.system.transform"], undefined);

  const on = await ArtifactsPlugin({} as unknown as PluginInput, { proactive: true });
  const transform = on["experimental.chat.system.transform"];
  assert.ok(transform);

  const output = { system: [] as string[] };
  await transform({}, output);
  assert.equal(output.system.length, 1);
  assert.match(output.system[0], /artifact_publish/);
  assert.match(output.system[0], /not fully delivered/);
});

test("stale conflict returns the live content for immediate merge", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const publish = hooks.tool?.artifact_publish;
  assert.ok(publish);

  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };

    const first = String(await publish.execute({ markdown: "---\ntitle: Guard Demo\n---\n# V1 marker\n" }, ctx));
    const hash = first.match(/hash: ([0-9a-f]{12})/)?.[1];
    assert.ok(hash);

    await publish.execute({ markdown: "---\ntitle: Guard Demo\n---\n# V2 marker\n" }, ctx);

    const conflict = String(
      await publish.execute(
        { markdown: "---\ntitle: Guard Demo\n---\n# V3 marker\n", expectedHash: hash },
        ctx,
      ),
    );
    assert.match(conflict, /Publish refused/);
    assert.match(conflict, /live version; raw HTML follows/);
    assert.match(conflict, /V2 marker/);
    assert.ok(!conflict.includes("V3 marker</h1>") || conflict.includes("V2 marker"));
  });
});

test("artifact_publish falls back to directory when worktree is /", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const publish = hooks.tool?.artifact_publish;
  assert.ok(publish);

  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: "/",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };
    const result = String(await publish.execute({ markdown: "# root probe\n" }, ctx));
    assert.match(result, /Artifact published to/);
    assert.match(result, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("artifact_db reads and writes collection documents", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const db = hooks.tool?.artifact_db;
  assert.ok(db);

  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };

    assert.match(
      String(await db.execute({ slug: "board", collection: "notes", op: "set", id: "n1", doc: { text: "hi", col: "now" } }, ctx)),
      /Wrote board\/notes\/n1/,
    );
    await db.execute({ slug: "board", collection: "notes", op: "set", id: "n2", doc: { text: "yo", col: "later" } }, ctx);

    const got = String(await db.execute({ slug: "board", collection: "notes", op: "get", id: "n1" }, ctx));
    assert.match(got, /hi/);

    const filtered = String(await db.execute({ slug: "board", collection: "notes", op: "list", q: "col:later" }, ctx));
    assert.match(filtered, /n2/);
    assert.ok(!filtered.includes("n1"));

    assert.match(
      String(await db.execute({ slug: "board", collection: "notes", op: "delete", id: "n1" }, ctx)),
      /Deleted/,
    );
    assert.match(
      String(await db.execute({ slug: "board", collection: "notes", op: "get", id: "n1" }, ctx)),
      /No document/,
    );
  });
});

test("artifact_db rejects path traversal before filesystem access", async () => {
  const db = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_db;
  assert.ok(db);
  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };
    const result = await db.execute(
      { slug: "board", collection: "../../../escaped", op: "set", id: "n1", doc: {} },
      ctx,
    );
    assert.match(String(result), /slug and collection must/);
    await assert.rejects(readFile(join(dir, ".opencode", "escaped.json"), "utf8"));
  });
});

test("artifact_comments lists threads and resolves by id", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const comments = hooks.tool?.artifact_comments;
  assert.ok(comments);

  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s1",
      messageID: "m1",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };

    assert.match(String(await comments.execute({ slug: "nope" }, ctx)), /No comments/);

    const stateDir = join(dir, ".opencode", "artifacts", ".state");
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, "page.comments.json"),
      JSON.stringify({
        threads: [
          { id: "t1", quote: "q", text: "fix this", createdAt: "2026-08-14", resolved: false },
        ],
      }),
    );

    const listed = String(await comments.execute({ slug: "page" }, ctx));
    assert.match(listed, /fix this/);

    const resolved = String(await comments.execute({ slug: "page", resolveId: "t1" }, ctx));
    assert.match(resolved, /Resolved thread t1/);
    const after = JSON.parse(
      await readFile(join(stateDir, "page.comments.json"), "utf8"),
    ) as { threads: Array<{ resolved: boolean }> };
    assert.equal(after.threads[0].resolved, true);

    await writeFile(
      join(stateDir, "page.comments.json"),
      JSON.stringify({
        threads: [
          { id: "t2", quote: "the funnel", text: "this drop is wrong", createdAt: new Date().toISOString(), resolved: false },
          { id: "t1", quote: "q", text: "fix this", createdAt: "2026-08-14", resolved: true },
        ],
      }),
    );
    const digest = String(await comments.execute({ slug: "page", digest: true }, ctx));
    assert.match(digest, /1 open, 1 resolved/);
    assert.match(digest, /\[t2\]/);
    assert.ok(!digest.includes("[t1]"));
  });
});
