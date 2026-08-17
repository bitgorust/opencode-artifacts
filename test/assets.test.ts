import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginInput, ToolContext } from "@opencode-ai/plugin";
import {
  AssetPreflightError,
  resolvePortableAssets,
} from "../src/assets.ts";
import { ArtifactTooLargeError, renderArtifact, renderPortableArtifact } from "../src/render.ts";
import { ArtifactsPlugin } from "../src/plugin.ts";
import { modelAsset } from "./model/asset-pipeline-model.ts";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function withRoot(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "portable-assets-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("contained PNG references become hashed data URIs with exact accounting", async () => {
  await withRoot(async (root) => {
    await mkdir(join(root, "media"));
    await writeFile(join(root, "media", "pixel.png"), PNG);
    const markdown = "![A one-pixel sample](media/pixel.png)";
    const assets = await resolvePortableAssets(markdown, root);
    const asset = assets.bySource.get("media/pixel.png");
    assert.ok(asset);
    assert.equal(asset.bytes, PNG.length);
    assert.equal(asset.encodedBytes, Buffer.byteLength(asset.dataUri));
    assert.equal(assets.assetBytes, PNG.length);
    assert.equal(assets.encodedBytes, asset.encodedBytes);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);

    const rendered = await renderPortableArtifact(markdown, root);
    assert.match(rendered.html, /src="data:image\/png;base64,/);
    assert.match(rendered.html, /alt="A one-pixel sample"/);
    assert.match(rendered.html, /data-asset-sha256="[a-f0-9]{64}"/);
    assert.ok(!rendered.html.includes('src="media/pixel.png"'));
  });
});

test("explicit decorative images retain empty alt and presentation semantics", async () => {
  await withRoot(async (root) => {
    await writeFile(join(root, "pixel.png"), PNG);
    const rendered = await renderPortableArtifact('![](pixel.png "decorative")', root);
    assert.match(rendered.html, /alt="" role="presentation"/);
    await assert.rejects(
      resolvePortableAssets("![](pixel.png)", root),
      (error: unknown) => error instanceof AssetPreflightError && error.code === "missing-alt",
    );
  });
});

test("safe SVG is reconstructed and active SVG is refused", async () => {
  await withRoot(async (root) => {
    const safe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Dot</title><circle cx="5" cy="5" r="4" fill="#123456"/></svg>';
    await writeFile(join(root, "safe.svg"), safe);
    const assets = await resolvePortableAssets("![Dot](safe.svg)", root);
    const decoded = Buffer.from(assets.bySource.get("safe.svg")?.dataUri.split(",")[1] ?? "", "base64").toString("utf8");
    assert.equal(decoded, safe);

    await writeFile(join(root, "active.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await assert.rejects(
      resolvePortableAssets("![Bad](active.svg)", root),
      (error: unknown) => error instanceof AssetPreflightError && error.code === "active-content",
    );
  });
});

test("preflight rejects external, traversal, encoded-separator, symlink, special, missing, and mislabeled assets", async () => {
  await withRoot(async (root) => {
    await writeFile(join(root, "target.png"), PNG);
    await symlink(join(root, "target.png"), join(root, "linked.png"));
    await mkdir(join(root, "directory.png"));
    await writeFile(join(root, "fake.png"), "not a png");
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["![x](https://example.com/a.png)", "external-asset"],
      ["![x](../outside-portable.png)", "invalid-path"],
      ["![x](media%2fpixel.png)", "invalid-path"],
      ["![x](linked.png)", "unsafe-path"],
      ["![x](directory.png)", "not-regular"],
      ["![x](missing.png)", "missing-asset"],
      ["![x](fake.png)", "type-mismatch"],
    ];
    for (const [markdown, code] of cases) {
      await assert.rejects(
        resolvePortableAssets(markdown, root),
        (error: unknown) => error instanceof AssetPreflightError && error.code === code && !error.message.includes("not a png"),
        `${markdown} should fail with ${code}`,
      );
    }
  });
});

test("per-file, aggregate, source, and count boundaries accept the limit and reject the next unit", async () => {
  await withRoot(async (root) => {
    await writeFile(join(root, "pixel.png"), PNG);
    await resolvePortableAssets("![x](pixel.png)", root, { maxAssetBytes: PNG.length, maxTotalBytes: PNG.length, maxMarkdownBytes: 100, maxAssetCount: 1 });
    await assert.rejects(resolvePortableAssets("![x](pixel.png)", root, { maxAssetBytes: PNG.length - 1 }), (error: unknown) => error instanceof AssetPreflightError && error.code === "asset-too-large");
    await assert.rejects(resolvePortableAssets("![x](pixel.png)\n\n![y](pixel.png)", root, { maxAssetCount: 1 }), (error: unknown) => error instanceof AssetPreflightError && error.code === "too-many-assets");
    await assert.rejects(resolvePortableAssets("![x](pixel.png)", root, { maxMarkdownBytes: Buffer.byteLength("![x](pixel.png)") - 1 }), (error: unknown) => error instanceof AssetPreflightError && error.code === "source-too-large");
    await assert.rejects(renderPortableArtifact("![x](pixel.png)", root, { maxBytes: 500 }), ArtifactTooLargeError);
  });
});

test("a file mutated after descriptor inspection is discarded", async () => {
  await withRoot(async (root) => {
    const path = join(root, "pixel.png");
    await writeFile(path, PNG);
    await assert.rejects(
      resolvePortableAssets("![x](pixel.png)", root, {}, {
        afterOpen: async () => { await writeFile(path, Buffer.concat([PNG, Buffer.from([0])])); },
      }),
      (error: unknown) => error instanceof AssetPreflightError && error.code === "changed-during-read",
    );
  });
});

test("font declarations are typed, hashed, and embedded without trusting the extension alone", async () => {
  await withRoot(async (root) => {
    const font = Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(32)]);
    await writeFile(join(root, "project.woff2"), font);
    const markdown = "---\ntitle: Font\nfont: project.woff2\n---\nText";
    const rendered = await renderPortableArtifact(markdown, root);
    assert.match(rendered.html, /@font-face/);
    assert.match(rendered.html, /data:font\/woff2;base64,/);
    await writeFile(join(root, "wrong.woff2"), PNG);
    await assert.rejects(resolvePortableAssets("---\nfont: wrong.woff2\n---\nx", root), (error: unknown) => error instanceof AssetPreflightError && error.code === "type-mismatch");
    const ttf = Buffer.concat([Buffer.from([0, 1, 0, 0]), Buffer.alloc(32)]);
    await writeFile(join(root, "project.ttf"), ttf);
    const ttfRendered = await renderPortableArtifact("---\nfont: project.ttf\n---\nx", root);
    assert.match(ttfRendered.html, /data:font\/ttf;base64,/);
    assert.match(ttfRendered.html, /format\("truetype"\)/);
    assert.match(ttfRendered.html, /font-src data:/);
  });
});

test("synchronous rendering never emits an unresolved network or file URL", () => {
  const html = renderArtifact("![Remote](https://example.com/a.png)").html;
  assert.match(html, /Asset preflight required/);
  assert.ok(!html.includes('src="https://example.com/a.png"'));
});

test("plugin asset refusal performs no permission request or publication write", async () => {
  await withRoot(async (root) => {
    const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
    assert.ok(publish);
    let asked = false;
    const context: ToolContext = {
      sessionID: "asset-test",
      messageID: "asset-test",
      agent: "test",
      directory: root,
      worktree: root,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => { asked = true; },
    };
    const result = await publish.execute({ markdown: "![Remote](https://example.com/a.png)" }, context);
    assert.match(String(result), /external-asset/);
    assert.equal(asked, false);
    await assert.rejects(readFile(join(root, ".opencode", "artifacts", "manifest.json")));
  });
});

test("plugin publication writes the expanded asset bytes rather than a worktree URL", async () => {
  await withRoot(async (root) => {
    await writeFile(join(root, "pixel.png"), PNG);
    const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
    assert.ok(publish);
    const context: ToolContext = {
      sessionID: "asset-success",
      messageID: "asset-success",
      agent: "test",
      directory: root,
      worktree: root,
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };
    const result = await publish.execute({ markdown: "---\ntitle: Asset page\n---\n![Pixel](pixel.png)" }, context);
    assert.match(String(result), /Artifact published/);
    const html = await readFile(join(root, ".opencode", "artifacts", "asset-page.html"), "utf8");
    assert.match(html, /src="data:image\/png;base64,/);
    assert.ok(!html.includes('src="pixel.png"'));
  });
});

test("bounded model either embeds exact base64 contribution or refuses without returned bytes or requests", () => {
  for (let mask = 0; mask < 32; mask++) {
    for (const bytes of [0, 1, 2, 3, 4, 15, 16]) {
      const result = modelAsset({
        relativeSyntax: (mask & 1) !== 0,
        contained: (mask & 2) !== 0,
        regular: (mask & 4) !== 0,
        stable: (mask & 8) !== 0,
        allowlisted: (mask & 16) !== 0,
        bytes,
        maxBytes: 15,
        mimePrefixBytes: 22,
      });
      assert.equal(result.viewTimeRequests, 0);
      if (mask === 31 && bytes <= 15) {
        assert.equal(result.result, "embedded");
        assert.equal(result.sourceBytesReturned, bytes);
        assert.equal(result.encodedBytes, 22 + 4 * Math.ceil(bytes / 3));
      } else {
        assert.deepEqual(result, { result: "refused", sourceBytesReturned: 0, encodedBytes: 0, viewTimeRequests: 0 });
      }
    }
  }
});
