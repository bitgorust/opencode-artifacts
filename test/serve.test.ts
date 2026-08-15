import { test } from "node:test";
import assert from "node:assert/strict";
import { get } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

test("malformed percent escapes return 400 without stopping the server", async () => {
  await withServer({ "a.html": "x" }, async (url) => {
    const status = await new Promise<number | undefined>((resolveStatus, reject) => {
      get(`${url}/%`, (response) => {
        response.resume();
        response.on("end", () => resolveStatus(response.statusCode));
      }).on("error", reject);
    });
    assert.equal(status, 400);
    assert.equal((await fetch(`${url}/a.html`)).status, 200);
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

test("comments endpoint round-trips threads and validates shape", async () => {
  await withServer({ "a.html": "x" }, async (url) => {
    const thread = {
      id: "abc",
      quote: "some quoted text",
      text: "why this?",
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    const posted = await fetch(`${url}/__comments/review-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threads: [thread] }),
    });
    assert.equal(posted.status, 200);

    const read = (await (await fetch(`${url}/__comments/review-page`)).json()) as {
      threads: Array<{ id: string; text: string }>;
    };
    assert.equal(read.threads.length, 1);
    assert.equal(read.threads[0].text, "why this?");

    const bad = await fetch(`${url}/__comments/review-page`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threads: [{ nope: true }] }),
    });
    assert.equal(bad.status, 400);
  });
});

test("db endpoint stores, queries, and deletes documents", async () => {
  await withServer({ "a.html": "x" }, async (url) => {
    const put = await fetch(`${url}/__db/board/notes/n1`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "first", col: "now" }),
    });
    assert.equal(put.status, 200);
    await fetch(`${url}/__db/board/notes/n2`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "second", col: "later" }),
    });

    const one = (await (await fetch(`${url}/__db/board/notes/n1`)).json()) as {
      doc: { text: string };
    };
    assert.equal(one.doc.text, "first");

    const filtered = (await (
      await fetch(`${url}/__db/board/notes?q=col:later`)
    ).json()) as { docs: Array<{ id: string }> };
    assert.deepEqual(
      filtered.docs.map((d) => d.id),
      ["n2"],
    );

    const deleted = await fetch(`${url}/__db/board/notes/n1`, { method: "DELETE" });
    assert.equal(deleted.status, 200);
    const gone = await fetch(`${url}/__db/board/notes/n1`);
    assert.equal(gone.status, 404);
  });
});

test("data endpoint runs only registered datasources", async () => {
  const dir = await mkdtemp(join(tmpdir(), "serve-"));
  await mkdir(join(dir, ".datasources"), { recursive: true });
  await writeFile(
    join(dir, ".datasources", "page.json"),
    JSON.stringify([{ name: "greeting", command: "printf", args: ["hello-live"] }]),
  );
  const served = await serveArtifacts({ dir, port: 0 });
  try {
    const ok = (await (await fetch(`${served.url}/__data/page/greeting`)).json()) as {
      output: string;
    };
    assert.equal(ok.output, "hello-live");

    const unknown = await fetch(`${served.url}/__data/page/nope`);
    assert.equal(unknown.status, 404);
  } finally {
    await served.close();
    await rm(dir, { recursive: true, force: true });
  }
});
