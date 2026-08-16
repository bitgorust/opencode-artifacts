import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleApiRequest, type KVStore } from "../src/cloudflare/handler.ts";
import { CloudflarePublisher } from "../src/cloudflare-publisher.ts";
import type { Runner } from "../src/github-pages.ts";

function memoryKv(): KVStore & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
  };
}

test("state round-trips through kv", async () => {
  const kv = memoryKv();
  const post = await handleApiRequest(
    new Request("https://w.dev/__state/plan", {
      method: "POST",
      body: JSON.stringify({ answers: { layout: "tabs" } }),
    }),
    kv,
  );
  assert.equal(post?.status, 200);

  const get = await handleApiRequest(new Request("https://w.dev/__state/plan"), kv);
  const body = (await get?.json()) as { answers: Record<string, string> };
  assert.equal(body.answers.layout, "tabs");
});

test("comments validate shape and persist", async () => {
  const kv = memoryKv();
  const bad = await handleApiRequest(
    new Request("https://w.dev/__comments/p", {
      method: "POST",
      body: JSON.stringify({ threads: [{ nope: true }] }),
    }),
    kv,
  );
  assert.equal(bad?.status, 400);

  await handleApiRequest(
    new Request("https://w.dev/__comments/p", {
      method: "POST",
      body: JSON.stringify({
        threads: [{ id: "t1", quote: "q", text: "why", createdAt: "x", resolved: false }],
      }),
    }),
    kv,
  );
  const get = await handleApiRequest(new Request("https://w.dev/__comments/p"), kv);
  const body = (await get?.json()) as { threads: Array<{ text: string }> };
  assert.equal(body.threads[0].text, "why");
});

test("db documents store, filter, and delete through kv", async () => {
  const kv = memoryKv();
  await handleApiRequest(
    new Request("https://w.dev/__db/board/notes/n1", {
      method: "PUT",
      body: JSON.stringify({ text: "a", col: "now" }),
    }),
    kv,
  );
  await handleApiRequest(
    new Request("https://w.dev/__db/board/notes/n2", {
      method: "PUT",
      body: JSON.stringify({ text: "b", col: "later" }),
    }),
    kv,
  );

  const filtered = await handleApiRequest(
    new Request("https://w.dev/__db/board/notes?q=col:later"),
    kv,
  );
  const body = (await filtered?.json()) as { docs: Array<{ id: string }> };
  assert.deepEqual(
    body.docs.map((d) => d.id),
    ["n2"],
  );

  await handleApiRequest(new Request("https://w.dev/__db/board/notes/n1", { method: "DELETE" }), kv);
  const gone = await handleApiRequest(new Request("https://w.dev/__db/board/notes/n1"), kv);
  assert.equal(gone?.status, 404);
});

test("datasources return 501 on hosted workers, non-api paths fall through", async () => {
  const kv = memoryKv();
  const data = await handleApiRequest(new Request("https://w.dev/__data/page/x"), kv);
  assert.equal(data?.status, 501);
  const passThrough = await handleApiRequest(new Request("https://w.dev/demo.html"), kv);
  assert.equal(passThrough, null);
});

test("cloudflare publisher stages worker, parses kv id, deploys, and returns the workers.dev url", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cf-"));
  const stagingDir = join(dir, "staging");
  const calls: string[] = [];
  const runner: Runner = async (command, args) => {
    calls.push(`${command} ${args.join(" ")}`);
    if (args.includes("namespace")) {
      return '✨ Success!\n[[kv_namespaces]]\nbinding = "ARTIFACTS_KV"\nid = "0123456789abcdef0123456789abcdef"';
    }
    if (args.includes("deploy")) {
      return "Uploaded opencode-artifacts (https://opencode-artifacts.bitgorust.workers.dev)";
    }
    return "";
  };

  const publisher = new CloudflarePublisher(join(dir, "local"), {
    workerName: "opencode-artifacts",
    stagingDir,
    runner,
  });
  const result = await publisher.publish({ slug: "demo", html: "<h1>hi</h1>", title: "Demo" });

  assert.equal(result.url, "https://opencode-artifacts.bitgorust.workers.dev/demo.html");
  assert.ok(calls.some((c) => c.includes("kv namespace create ARTIFACTS_KV_opencode-artifacts")));
  assert.ok(calls.some((c) => c.includes("wrangler deploy")));

  const toml = await readFile(join(stagingDir, "wrangler.toml"), "utf8");
  assert.match(toml, /id = "0123456789abcdef0123456789abcdef"/);
  assert.match(toml, /main = "main\/cloudflare\/worker\.js"/);
  assert.match(await readFile(join(stagingDir, "assets", "demo.html"), "utf8"), /<h1>hi<\/h1>/);

  const { mkdir: mkdirp, writeFile: writeF } = await import("node:fs/promises");
  await mkdirp(join(dir, "local", ".state"), { recursive: true });
  await writeF(join(dir, "local", ".state", "answers.json"), "{}");
  await publisher.deploy();
  await assert.rejects(readFile(join(stagingDir, "assets", ".state", "answers.json"), "utf8"));

  await rm(dir, { recursive: true, force: true });
});

test("cloudflare publishers use worker-specific KV namespace titles", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cf-kv-"));
  try {
    await mkdir(join(dir, "local"));
    const calls: string[] = [];
    const runner: Runner = async (command, args) => {
      calls.push(`${command} ${args.join(" ")}`);
      if (args.includes("create")) return 'id = "0123456789abcdef0123456789abcdef"';
      if (args.includes("deploy")) return "deployed";
      return "[]";
    };
    await new CloudflarePublisher(join(dir, "local"), {
      workerName: "team-site",
      stagingDir: join(dir, "staging"),
      runner,
    }).deploy();
    assert.ok(calls.some((call) => call.includes("namespace create ARTIFACTS_KV_team-site")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cloudflare deploy blocks sensitive stale files in the reused staging tree", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cf-stale-"));
  try {
    const localDir = join(dir, "local");
    const stagingDir = join(dir, "staging");
    await mkdir(localDir);
    await mkdir(join(stagingDir, "assets"), { recursive: true });
    await writeFile(join(localDir, "clean.html"), "<h1>clean</h1>");
    await writeFile(
      join(stagingDir, "assets", "stale.json"),
      "ghp_0123456789abcdefABCDEF0123456789",
    );
    const calls: string[] = [];
    const publisher = new CloudflarePublisher(localDir, {
      workerName: "opencode-artifacts",
      stagingDir,
      runner: async (command, args) => {
        calls.push(`${command} ${args.join(" ")}`);
        return "";
      },
    });
    await assert.rejects(publisher.deploy(), /deploy blocked.*stale\.json/);
    assert.deepEqual(calls, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
