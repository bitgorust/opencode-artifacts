import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginInput, ToolContext } from "@opencode-ai/plugin";
import { ArtifactsPlugin } from "../src/plugin.ts";
import { FilePublisher } from "../src/publisher.ts";
import { replaceArtifactState } from "../src/artifact-state.ts";
import { emptyArtifactManifestV2, readArtifactManifestV2 } from "../src/artifact-schema.ts";
import { ArtifactLifecycleStore } from "../src/artifact-lifecycle.ts";
import { MAX_TOOL_METADATA_BYTES, MAX_TOOL_OUTPUT_BYTES } from "../src/opencode-results.ts";

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
    assert.equal(asked[0].always.length, 1);
    assert.notEqual(asked[0].always[0], "*");
    assert.equal("title" in asked[0].metadata, false);
    assert.match(String(result), /Artifact published to .*demo-page\.html/);
    assert.equal(typeof result, "object");
    if (typeof result === "object") {
      assert.equal(result.metadata?.["artifactResult"]?.schemaVersion, 1);
      assert.equal(result.metadata?.["artifactResult"]?.operation, "create-or-update");
      assert.equal(result.metadata?.["artifactResult"]?.visibility, "local");
    }

    const page = await readFile(join(dir, ".opencode", "artifacts", "demo-page.html"), "utf8");
    assert.match(page, /<h1 id="hello">Hello<\/h1>/);
    assert.match(page, /artifact-footer/);

    const gallery = await readFile(join(dir, ".opencode", "artifacts", "index.html"), "utf8");
    assert.match(gallery, /Demo Page/);
  });
});

test("artifact_publish resolves every authority before mutation and fails closed on denial", async () => {
  const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
  assert.ok(publish);
  const order = ["artifact_publish", "artifact_datasource", "artifact_deploy", "artifact_audience"];
  for (const denied of order) {
    await withWorktree(async (dir) => {
      const asked: Array<Parameters<ToolContext["ask"]>[0]> = [];
      const ctx: ToolContext = {
        sessionID: "s-deny",
        messageID: "m-deny",
        agent: "test",
        directory: dir,
        worktree: dir,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async (input) => {
          asked.push(input);
          if (input.permission === denied) throw new Error("denied by test policy");
        },
      };
      const result = String(await publish.execute({
        markdown: "---\ntitle: Permission Probe\n---\n# Safe\n",
        dataSources: [{ name: "latency", command: "/usr/local/bin/collect", args: ["not-in-metadata"] }],
        deploy: true,
        target: "github",
        repo: "team/artifacts",
      }, ctx));
      assert.match(result, /"error": "permission-denied"/);
      assert.match(result, new RegExp(`"permission": "${denied}"`));
      assert.match(result, /"mutation": "none"/);
      assert.deepEqual(
        asked.map((input) => input.permission),
        order.slice(0, order.indexOf(denied) + 1),
      );
      assert.ok(asked.filter((input) => input.permission !== "artifact_publish").every((input) => input.always.length === 0));
      assert.doesNotMatch(JSON.stringify(asked), /not-in-metadata|# Safe|\/usr\/local\/bin/);
      await assert.rejects(readFile(join(dir, ".opencode", "artifacts", "manifest.json"), "utf8"));
      await assert.rejects(readFile(join(dir, ".opencode", "artifacts", ".datasources", "permission-probe.json"), "utf8"));
    });
  }
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

test("artifact_publish scans frontmatter metadata before writing manifests or galleries", async () => {
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
      {
        markdown: [
          "---",
          "title: Clean title",
          "description: ghp_0123456789abcdefABCDEF0123456789",
          "source: synthetic",
          "---",
          "# Clean body",
        ].join("\n"),
      },
      ctx,
    );
    assert.match(String(result), /Publish blocked/);
    await assert.rejects(readFile(join(dir, ".opencode", "artifacts", "manifest.json"), "utf8"));
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

test("plugin state surfaces expose schema-2 CAS metadata and conditional mutations", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const db = hooks.tool?.artifact_db;
  const state = hooks.tool?.artifact_state;
  const comments = hooks.tool?.artifact_comments;
  assert.ok(db && state && comments);
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
    const root = join(dir, ".opencode", "artifacts");
    const artifactId = "11111111-1111-4111-8111-111111111111";
    await new FilePublisher(root, { schemaVersion: 2, artifactIdFactory: () => artifactId }).publish({ slug: "board", html: "board" });
    await replaceArtifactState({
      root,
      artifactId,
      kind: "decisions",
      expectedRevision: 0,
      operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      payload: { answers: { layout: "tabs" } },
      now: "2026-08-16T20:00:00Z",
    });
    assert.match(String(await state.execute({ slug: "board" }, ctx)), /"revision": 1/);

    const created = String(await db.execute({
      slug: "board",
      collection: "notes",
      op: "set",
      id: "n1",
      doc: { text: "hi" },
      expectedRevision: 0,
      createOnly: true,
      operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }, ctx));
    assert.match(created, /"status": "committed"/);
    assert.match(String(await db.execute({ slug: "board", collection: "notes", op: "get", id: "n1" }, ctx)), /"hash"/);

    await replaceArtifactState({
      root,
      artifactId,
      kind: "comments",
      expectedRevision: 0,
      operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      payload: { threads: [{ id: "t1", quote: "q", text: "fix", createdAt: "2026-08-16T20:00:00Z", resolved: false }] },
      now: "2026-08-16T20:00:00Z",
    });
    const resolved = String(await comments.execute({
      slug: "board",
      resolveId: "t1",
      expectedRevision: 1,
      operationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }, ctx));
    assert.match(resolved, /"revision": 2/);
  });
});

test("plugin lifecycle tool and publish arguments enforce exact updates and archive permission", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput);
  const publish = hooks.tool?.artifact_publish;
  const lifecycle = hooks.tool?.artifact_lifecycle;
  assert.ok(publish && lifecycle);
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
      ask: async (input) => { asked.push(input); },
    };
    const root = join(dir, ".opencode", "artifacts");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "manifest.json"), `${JSON.stringify(emptyArtifactManifestV2(), null, 2)}\n`, "utf8");
    const created = String(await publish.execute({ markdown: "---\ntitle: Report\n---\n# One" }, ctx));
    assert.match(created, /Artifact published/);
    const manifest = await readArtifactManifestV2(root);
    const id = manifest.slugIndex.report;
    const collision = String(await publish.execute({ markdown: "---\ntitle: Report\n---\n# Lost" }, ctx));
    assert.match(collision, /"error": "stale"/);
    const updated = String(await publish.execute({ markdown: "---\ntitle: Report\n---\n# Two", artifact: id, expectedRevision: 1 }, ctx));
    assert.match(updated, /Artifact published/);
    assert.match(String(await lifecycle.execute({ op: "list" }, ctx)), new RegExp(id));
    assert.match(String(await lifecycle.execute({ op: "restore", artifact: id, revision: 1, expectedRevision: 2 }, ctx)), /"headRevision": 3/);
    const preview = JSON.parse(String(await lifecycle.execute({ op: "archive-preview", artifact: id }, ctx))) as { token: string };
    assert.match(String(await lifecycle.execute({ op: "archive-confirm", token: preview.token }, ctx)), /"active": false/);
    assert.equal(asked.some((input) => input.permission === "artifact_archive" && input.patterns.includes(id)), true);
    assert.match(String(await lifecycle.execute({ op: "unarchive", artifact: id }, ctx)), /"active": true/);
  });
});

test("lifecycle reopen resolves exact local and registered references with bounded results", async () => {
  const opened: string[] = [];
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput, {
    launcher: async (target: string) => { opened.push(target); },
  });
  const publish = hooks.tool?.artifact_publish;
  const lifecycle = hooks.tool?.artifact_lifecycle;
  assert.ok(publish && lifecycle);
  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s-reopen",
      messageID: "m-reopen",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };
    const root = join(dir, ".opencode", "artifacts");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "manifest.json"), `${JSON.stringify(emptyArtifactManifestV2(), null, 2)}\n`, "utf8");
    const created = await publish.execute({ markdown: "---\ntitle: Reopen Me\n---\n# Exact" }, ctx);
    assert.equal(typeof created, "object");
    const manifest = await readArtifactManifestV2(root);
    const id = manifest.slugIndex["reopen-me"];
    assert.ok(id);

    const local = await lifecycle.execute({ op: "reopen", artifact: "reopen-me" }, ctx);
    assert.deepEqual(opened, [join(root, "reopen-me.html")]);
    assert.match(String(local), /"opened"/);
    if (typeof local === "object") {
      assert.equal(local.metadata?.["artifactResult"]?.operation, "reopen");
      assert.equal(local.metadata?.["artifactResult"]?.artifactId, id);
      assert.equal(local.metadata?.["artifactResult"]?.visibility, "local");
    }

    const url = "https://example.test/artifacts/reopen-me.html";
    await new ArtifactLifecycleStore(root).recordDeployment(id, {
      capability: "public-static",
      target: "test:public",
      url,
    });
    const remote = await lifecycle.execute({ op: "reopen", artifact: url }, ctx);
    assert.deepEqual(opened, [join(root, "reopen-me.html"), url]);
    if (typeof remote === "object") assert.equal(remote.metadata?.["artifactResult"]?.url, url);

    const beforeInvalid = opened.length;
    const invalid = await lifecycle.execute({ op: "reopen", artifact: "../escape" }, ctx);
    assert.equal(opened.length, beforeInvalid);
    assert.match(String(invalid), /reference refused/i);

    const read = await lifecycle.execute({ op: "read", artifact: id }, ctx);
    assert.equal(typeof read, "object");
    if (typeof read === "object") {
      assert.ok(Buffer.byteLength(read.output, "utf8") <= MAX_TOOL_OUTPUT_BYTES);
      assert.ok(Buffer.byteLength(JSON.stringify(read.metadata), "utf8") <= MAX_TOOL_METADATA_BYTES);
      assert.match(String(read.metadata?.["artifactResult"]?.path), /\/revisions\//);
    }
  });
});

test("reopen launcher failures and command conflicts remain recoverable", async () => {
  const hooks = await ArtifactsPlugin({} as unknown as PluginInput, {
    launcher: async () => { throw new Error("launcher unavailable"); },
  });
  const publish = hooks.tool?.artifact_publish;
  const lifecycle = hooks.tool?.artifact_lifecycle;
  assert.ok(publish && lifecycle && hooks.config);
  await withWorktree(async (dir) => {
    const ctx: ToolContext = {
      sessionID: "s-launch-fail",
      messageID: "m-launch-fail",
      agent: "test",
      directory: dir,
      worktree: dir,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };
    const root = join(dir, ".opencode", "artifacts");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "manifest.json"), `${JSON.stringify(emptyArtifactManifestV2(), null, 2)}\n`, "utf8");
    await publish.execute({ markdown: "---\ntitle: Launch Fail\n---\n# Exact" }, ctx);
    const result = await lifecycle.execute({ op: "reopen", artifact: "launch-fail" }, ctx);
    assert.match(String(result), /launcher accepted/);
    if (typeof result === "object") assert.equal(result.metadata?.["artifactResult"]?.error, "launch-failed");
  });

  const config: Parameters<NonNullable<typeof hooks.config>>[0] = { command: {} };
  await hooks.config(config);
  assert.match(config.command?.["artifact-reopen"]?.template ?? "", /artifact_lifecycle/);
  assert.match(config.command?.["artifact-reopen"]?.template ?? "", /\$ARGUMENTS/);
  config.command!["artifact-reopen"] = { template: "user-owned" };
  await hooks.config(config);
  assert.equal(config.command?.["artifact-reopen"]?.template, "user-owned");
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
