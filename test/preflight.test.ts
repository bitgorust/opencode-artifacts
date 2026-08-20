import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { PluginInput, ToolContext } from "@opencode-ai/plugin";
import { preflightDocument, formatPreflight, trustedHtmlDiagnostic } from "../src/preflight.ts";
import { COMPONENT_KINDS, renderComponent, validateComponent } from "../src/components.ts";
import { renderArtifact } from "../src/render.ts";
import { ArtifactsPlugin } from "../src/plugin.ts";

const execFileAsync = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");

async function withTemp(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "authoring-preflight-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

const MULTI_ERROR = [
  "---",
  "title: Example",
  "not valid frontmatter",
  "---",
  "```stats",
  "{secret: ghp_0123456789abcdefABCDEF0123456789}",
  "```",
  "```progress",
  '{"done": 5, "total": 2}',
  "```",
  "```mermaid",
  "```",
  "## Same",
  "## Same",
  "> [!UNKNOWN] nope",
].join("\n");
const MULTI_ERROR_SAFE = MULTI_ERROR.replace("ghp_0123456789abcdefABCDEF0123456789", "redacted-token");

test("preflight aggregates stable located diagnostics in source order without payloads", async () => {
  const first = await preflightDocument(MULTI_ERROR, { worktreeRoot: ROOT });
  const second = await preflightDocument(MULTI_ERROR, { worktreeRoot: ROOT });
  assert.deepEqual(first, second);
  assert.deepEqual(first.diagnostics.map((item) => item.code), [
    "frontmatter-syntax",
    "stats-json",
    "progress-range",
    "mermaid-empty",
    "anchor-duplicate",
    "alert-unknown",
  ]);
  assert.deepEqual(first.diagnostics.map((item) => item.line), [3, 5, 8, 11, 14, 15]);
  const formatted = formatPreflight(first);
  assert.ok(!formatted.includes("ghp_0123456789abcdefABCDEF0123456789"));
  assert.ok(Buffer.byteLength(formatted) < 16 * 1024);
});

test("diagnostic count truncation ends with an explicit omitted marker", async () => {
  const result = await preflightDocument(MULTI_ERROR, { maxDiagnostics: 3 });
  assert.equal(result.diagnostics.length, 3);
  assert.equal(result.diagnostics.at(-1)?.code, "diagnostics-omitted");
  assert.ok(result.omitted >= 4);
});

test("diagnostic byte truncation stays bounded and ends with an omitted marker", async () => {
  const result = await preflightDocument(MULTI_ERROR, { maxDiagnosticBytes: 1024 });
  assert.equal(result.diagnostics.at(-1)?.code, "diagnostics-omitted");
  assert.ok(result.omitted > 0);
  assert.ok(Buffer.byteLength(JSON.stringify(result.diagnostics)) <= 1024);
});

test("preflight reports each independent asset reference at its source line", async () => {
  await withTemp(async (root) => {
    const result = await preflightDocument("![One](missing.png)\n\n![Two](https://example.com/two.png)\n\n![Again](missing.png)", { worktreeRoot: root });
    assert.deepEqual(result.diagnostics.map((item) => item.code), [
      "asset-missing-asset",
      "asset-external-asset",
      "asset-missing-asset",
    ]);
    assert.deepEqual(result.diagnostics.map((item) => item.line), [1, 3, 5]);
  });
});

test("component preflight and inline fallback share validation", () => {
  const cases: Array<[Parameters<typeof validateComponent>[0], string, string]> = [
    ["stats", '[{"label":"x"}]', "stats-value"],
    ["timeline", '[{"title":"x"}]', "timeline-time"],
    ["findings", '[{"title":"x","severity":"urgent"}]', "findings-severity"],
    ["compare", '[{"title":"x","annotations":[1]}]', "compare-annotations"],
    ["callout", '{"tone":"loud"}', "callout-tone"],
    ["progress", '{"done":2,"total":1}', "progress-range"],
    ["copy", '{}', "copy-text"],
    ["diff", "", "diff-empty"],
    ["mermaid", "", "mermaid-empty"],
    ["decisions", '{"questions":[{"id":"q","question":"Q","options":[{}]}]}', "decisions-option"],
    ["table", '{"caption":"Values","columns":[{"key":"x","label":"X"},{"key":"x","label":"Y"}],"rows":[]}', "table-key"],
    ["frame", '{"kind":"unknown"}', "frame-kind"],
  ];
  for (const [kind, source, code] of cases) {
    assert.equal(validateComponent(kind, source)[0]?.code, code);
    assert.match(renderComponent(kind, source), /chart-error/);
  }
  assert.deepEqual(new Set(cases.map(([kind]) => kind)), COMPONENT_KINDS);
});

test("chart preflight and inline fallback share validation", async () => {
  const markdown = "```vega-lite\n{\"description\":\"An invalid chart used for fallback parity.\",\"mark\":\"not-a-mark\"}\n```";
  const result = await preflightDocument(markdown);
  assert.equal(result.diagnostics[0]?.code, "vega-lite-invalid");
  assert.match(renderArtifact(markdown).html, /chart-error/);
});

test("every checked-in example has zero preflight errors", async () => {
  for (const name of await readdir(join(ROOT, "examples", "patterns"))) {
    if (!name.endsWith(".md")) continue;
    const markdown = await readFile(join(ROOT, "examples", "patterns", name), "utf8");
    const result = await preflightDocument(markdown, { worktreeRoot: ROOT });
    assert.deepEqual(result.diagnostics.filter((item) => item.severity === "error"), [], name);
  }
});

test("plugin returns all preflight errors before permission or writes", async () => {
  await withTemp(async (root) => {
    const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
    assert.ok(publish);
    let asked = false;
    const context: ToolContext = {
      sessionID: "preflight", messageID: "preflight", agent: "test", directory: root, worktree: root,
      abort: new AbortController().signal, metadata: () => {}, ask: async () => { asked = true; },
    };
    const output = String(await publish.execute({ markdown: MULTI_ERROR_SAFE }, context));
    assert.match(output, /authoring-preflight/);
    for (const code of ["frontmatter-syntax", "stats-json", "progress-range", "mermaid-empty", "anchor-duplicate", "alert-unknown"]) {
      assert.match(output, new RegExp(code));
    }
    assert.equal(asked, false);
    await assert.rejects(readFile(join(root, ".opencode", "artifacts", "manifest.json")));
  });
});

test("CLI refuses invalid authoring before creating an output file", async () => {
  await withTemp(async (root) => {
    const input = join(root, "bad.md");
    const output = join(root, "bad.html");
    await writeFile(input, MULTI_ERROR_SAFE);
    await assert.rejects(execFileAsync(process.execPath, [join(ROOT, "src", "cli.ts"), "render", input, "-o", output], { cwd: root }), (error: unknown) => {
      if (typeof error !== "object" || error === null || !("stderr" in error)) return false;
      const stderr = String(error.stderr);
      return ["frontmatter-syntax", "stats-json", "progress-range", "mermaid-empty", "anchor-duplicate", "alert-unknown"].every((code) => stderr.includes(code));
    });
    await assert.rejects(readFile(output));
  });
});

test("trusted HTML disclosure is stable and actionable", () => {
  const warning = trustedHtmlDiagnostic();
  assert.equal(warning.code, "trusted-html-mode");
  assert.equal(warning.severity, "warning");
  assert.match(warning.nextAction, /review/i);
});

test("plugin publishes warnings visibly and marks trusted HTML permission metadata", async () => {
  await withTemp(async (root) => {
    const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
    assert.ok(publish);
    const asked: Array<Parameters<ToolContext["ask"]>[0]> = [];
    const context: ToolContext = {
      sessionID: "warnings", messageID: "warnings", agent: "test", directory: root, worktree: root,
      abort: new AbortController().signal, metadata: () => {}, ask: async (input) => { asked.push(input); },
    };
    const markdownOutput = String(await publish.execute({ markdown: "# Warning\n\n> [!UNKNOWN] visible" }, context));
    assert.match(markdownOutput, /Preflight warnings: alert-unknown at 3:1/);
    const htmlOutput = String(await publish.execute({ markdown: "<main>trusted</main>", title: "Trusted", format: "html" }, context));
    assert.match(htmlOutput, /Preflight warnings: trusted-html-mode at 1:1/);
    assert.equal(asked.at(-1)?.metadata?.trustedHtml, true);
    assert.equal(asked.at(-1)?.metadata?.format, "html");
  });
});
