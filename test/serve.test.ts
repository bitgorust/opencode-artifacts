import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveArtifacts } from "../src/serve.ts";

async function withServer(
  files: Record<string, string>,
  run: (url: string, dir: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "serve-"));
  const served = await serveArtifacts({ dir, port: 0 });
  try {
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(dir, name), content);
    }
    await run(served.url, dir);
  } finally {
    await served.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("serves html with the live-reload snippet injected", async () => {
  await withServer({ "a.html": "<html><body>hi</body></html>" }, async (url) => {
    const res = await fetch(`${url}/a.html`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('EventSource("/__sse")'));
    assert.ok(text.includes("hi"));
  });
});

test("served pages relax connect-src to self, on-disk file stays strict", async () => {
  const strict = "<meta content=\"default-src 'none'; connect-src 'none'\"><html><body>x</body></html>";
  await withServer({ "a.html": strict }, async (url, dir) => {
    const served = await (await fetch(`${url}/a.html`)).text();
    assert.ok(served.includes("connect-src 'self'"));
    const onDisk = await readFile(join(dir, "a.html"), "utf8");
    assert.ok(onDisk.includes("connect-src 'none'"));
  });
});

test("blocks path traversal outside the served directory", async () => {
  await withServer({ "a.html": "x" }, async (url) => {
    const res = await fetch(`${url}/..%2f..%2fetc%2fpasswd`);
    assert.equal(res.status, 403);
  });
});

test("sends an SSE reload event when an html file changes", async () => {
  await withServer({ "a.html": "v1" }, async (url, dir) => {
    const controller = new AbortController();
    const res = await fetch(`${url}/__sse`, { signal: controller.signal });
    assert.ok(res.body);
    const reader = res.body.getReader();

    const heard = (async () => {
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return false;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: reload")) return true;
      }
    })();

    await new Promise((wait) => setTimeout(wait, 150));
    await writeFile(join(dir, "a.html"), "v2");

    const timeout = new Promise<false>((giveUp) => setTimeout(() => giveUp(false), 3000));
    assert.equal(await Promise.race([heard, timeout]), true);
    controller.abort();
  });
});

test("state endpoint round-trips posted answers and rejects bad slugs", async () => {
  await withServer({ "a.html": "x" }, async (url) => {
    const bad = await fetch(`${url}/__state/..%2Fevil`, { method: "POST", body: "{}" });
    assert.equal(bad.status, 400);

    const posted = await fetch(`${url}/__state/plan-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "layout", option: "tabs" }),
    });
    assert.equal(posted.status, 200);

    const read = await fetch(`${url}/__state/plan-review`);
    const body = (await read.json()) as { answers: Record<string, string> };
    assert.equal(body.answers.layout, "tabs");

    const replaced = await fetch(`${url}/__state/plan-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: { layout: "tabs", density: "no" } }),
    });
    assert.equal(replaced.status, 200);
    const reread = (await (await fetch(`${url}/__state/plan-review`)).json()) as {
      answers: Record<string, string>;
    };
    assert.deepEqual(reread.answers, { layout: "tabs", density: "no" });
  });
});
