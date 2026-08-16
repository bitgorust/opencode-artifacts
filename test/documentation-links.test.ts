import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectDocumentationLinks,
  extractDocumentationLinks,
  markdownAnchors,
  probeOfficialLinks,
  validateLocalDocumentationLinks,
} from "../scripts/documentation-links.ts";

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "artifact-doc-links-"));
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
  }
  return root;
}

test("local documentation links resolve files and duplicate GitHub-style anchors", async () => {
  const root = await fixture({
    "README.md": "[first](docs/guide.md#hello-world) [second](docs/guide.md#hello-world-1) [encoded](docs/with%20space.md#encoded-heading)\n",
    "docs/guide.md": "# Hello, world!\n\n## Hello, world!\n",
    "docs/with space.md": "# Encoded heading\n",
  });
  try {
    assert.deepEqual(await validateLocalDocumentationLinks(root), []);
    assert.deepEqual([...markdownAnchors("# A!\n## A!\n")], ["a", "a-1"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local documentation validation reports missing paths, anchors, and escapes with source lines", async () => {
  const root = await fixture({
    "README.md": [
      "[missing](docs/nope.md)",
      "[anchor](docs/guide.md#absent)",
      "[escape](../outside.md)",
      "[invalid](docs/%ZZ.md)",
    ].join("\n"),
    "docs/guide.md": "# Present\n",
  });
  try {
    const issues = await validateLocalDocumentationLinks(root);
    assert.deepEqual(issues.map((issue) => [issue.line, issue.reason]), [
      [1, "missing-path"],
      [2, "missing-anchor"],
      [3, "path-escape"],
      [4, "invalid-target"],
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("link extraction ignores code and distinguishes official from other external links", () => {
  const markdown = [
    "\`[inline](missing.md)\`",
    "\`\`\`md",
    "[fenced](missing.md)",
    "\`\`\`",
    "[OpenCode](https://opencode.ai/docs/plugins/)",
    "[Example](https://example.com/)",
    "[mail](mailto:security@example.com)",
  ].join("\n");
  assert.deepEqual(
    extractDocumentationLinks(markdown, "README.md").map((link) => [link.line, link.kind]),
    [[5, "official"], [6, "external"]],
  );
});

test("official probing preserves pass, terminal, transient, and timeout outcomes", async () => {
  const root = await fixture({
    "README.md": [
      "[ok](https://docs.github.com/ok)",
      "[gone](https://docs.github.com/gone)",
      "[busy](https://docs.github.com/busy)",
      "[slow](https://docs.github.com/slow)",
    ].join("\n"),
  });
  try {
    const links = await collectDocumentationLinks(root);
    const results = await probeOfficialLinks(links, {
      timeoutMs: 5,
      fetcher: async (url, signal) => {
        if (url.endsWith("/ok")) return { status: 200, url };
        if (url.endsWith("/gone")) return { status: 404, url };
        if (url.endsWith("/busy")) return { status: 503, url };
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      },
    });
    assert.deepEqual(results.map((result) => result.status), [
      "transient-failure",
      "terminal-failure",
      "pass",
      "timeout",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
