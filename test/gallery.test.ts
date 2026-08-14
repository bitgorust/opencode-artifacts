import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FilePublisher, StaleArtifactError, type Manifest } from "../src/publisher.ts";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "artifacts-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const PAGE = `<!doctype html><html><body><main>x</main>\n<!--artifact:footer-->\n</body></html>`;

test("publish maintains manifest with version history and regenerates gallery", async () => {
  await withTempDir(async (dir) => {
    const publisher = new FilePublisher(dir);
    await publisher.publish({ slug: "report", html: PAGE, title: "Report", icon: "📊", version: true });
    await publisher.publish({ slug: "report", html: PAGE, title: "Report", icon: "📊", version: true });

    const manifest: Manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    assert.deepEqual(manifest.artifacts.report.versions, [1, 2]);
    assert.equal(manifest.artifacts.report.current, 2);
    assert.equal(manifest.artifacts.report.title, "Report");

    const gallery = await readFile(join(dir, "index.html"), "utf8");
    assert.match(gallery, /href="report\.html"/);
    assert.match(gallery, /v2 · 2 version\(s\)/);
    assert.match(gallery, /Content-Security-Policy/);
  });
});

test("publisher injects footer with current version into stable and versioned files", async () => {
  await withTempDir(async (dir) => {
    const publisher = new FilePublisher(dir);
    await publisher.publish({ slug: "report", html: PAGE, version: true });
    await publisher.publish({ slug: "report", html: PAGE, version: true });

    const stable = await readFile(join(dir, "report.html"), "utf8");
    assert.match(stable, /artifact-footer/);
    assert.match(stable, /· v2 ·/);
    assert.match(stable, /href="index\.html"/);

    const v1 = await readFile(join(dir, "report.v1.html"), "utf8");
    assert.match(v1, /· v1 ·/);
  });
});

test("latest returns the most recently updated artifact", async () => {
  await withTempDir(async (dir) => {
    const publisher = new FilePublisher(dir);
    await publisher.publish({ slug: "alpha", html: PAGE, title: "Alpha" });
    await new Promise((wait) => setTimeout(wait, 5));
    await publisher.publish({ slug: "beta", html: PAGE, title: "Beta" });
    assert.equal((await publisher.latest())?.slug, "beta");
  });
});

test("restore points the stable path back at an older version", async () => {  await withTempDir(async (dir) => {
    const publisher = new FilePublisher(dir);
    await publisher.publish({ slug: "report", html: "one\n<!--artifact:footer-->", version: true });
    await publisher.publish({ slug: "report", html: "two\n<!--artifact:footer-->", version: true });

    const result = await publisher.restore("report", 1);
    assert.equal(result.version, 1);
    assert.match(await readFile(result.path, "utf8"), /^one/);

    const manifest: Manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.artifacts.report.current, 1);

    await assert.rejects(() => publisher.restore("report", 9), /unknown version/);
    await assert.rejects(() => publisher.restore("nope", 1), /unknown artifact/);
  });
});

test("gallery card shows the description subtitle", async () => {
  await withTempDir(async (dir) => {
    const publisher = new FilePublisher(dir);
    await publisher.publish({
      slug: "report",
      html: PAGE,
      title: "Report",
      description: "Weekly deploy health",
    });
    const gallery = await readFile(join(dir, "index.html"), "utf8");
    assert.match(gallery, /class="desc">Weekly deploy health</);
  });
});

test("stale guard refuses to publish over an unseen version", async () => {
  await withTempDir(async (dir) => {
    const publisher = new FilePublisher(dir);
    const first = await publisher.publish({ slug: "report", html: "one" });
    assert.equal(typeof first.hash, "string");
    assert.equal(first.hash.length, 12);

    await assert.rejects(
      publisher.publish({ slug: "report", html: "two", expectedHash: "000000000000" }),
      StaleArtifactError,
    );
    assert.equal(await readFile(join(dir, "report.html"), "utf8"), "one");

    const second = await publisher.publish({
      slug: "report",
      html: "two",
      expectedHash: first.hash,
    });
    assert.notEqual(second.hash, first.hash);
    assert.equal(await readFile(join(dir, "report.html"), "utf8"), "two");
  });
});
