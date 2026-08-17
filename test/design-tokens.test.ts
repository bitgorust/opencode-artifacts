import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { PluginInput, ToolContext } from "@opencode-ai/plugin";
import {
  DESIGN_TOKEN_FILE,
  MAX_DESIGN_TOKEN_BYTES,
  loadProjectDesignTokens,
  resolveDesignTokens,
} from "../src/design-tokens.ts";
import { preflightDocument } from "../src/preflight.ts";
import { renderArtifact, renderRawHtml } from "../src/render.ts";
import { ArtifactsPlugin } from "../src/plugin.ts";

const execFileAsync = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");

async function withTemp(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "design-tokens-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

async function writeProject(root: string, value: unknown): Promise<void> {
  await mkdir(join(root, ".opencode"), { recursive: true });
  await writeFile(join(root, DESIGN_TOKEN_FILE), `${JSON.stringify(value)}\n`);
}

const MARKDOWN = [
  "---",
  "title: Token Surface",
  "theme: report",
  "---",
  "```design-tokens",
  '{"schemaVersion":1,"tokens":{"accent":"#8b1e3f","radius":"soft"}}',
  "```",
  "# Token Surface",
  "",
  "## Summary",
  "A deterministic token page.",
].join("\n");

test("prompt tokens outrank project and theme with deterministic provenance and CSS", async () => {
  await withTemp(async (root) => {
    await writeProject(root, { schemaVersion: 1, tokens: { accent: "#005a9c", spacing: "compact", font: "mono" } });
    const first = await preflightDocument(MARKDOWN, { worktreeRoot: root });
    const second = await preflightDocument(MARKDOWN, { worktreeRoot: root });
    assert.deepEqual(first, second);
    assert.deepEqual(first.diagnostics, []);
    assert.equal(first.designTokens?.values.accent, "#8b1e3f");
    assert.equal(first.designTokens?.values.spacing, "compact");
    assert.equal(first.designTokens?.values.pageBackground, "#f6f0e4");
    assert.equal(first.designTokens?.provenance.accent, "prompt");
    assert.equal(first.designTokens?.provenance.spacing, "project");
    assert.equal(first.designTokens?.provenance.pageBackground, "theme");

    const firstHtml = renderArtifact(MARKDOWN, { designTokens: first.designTokens }).html;
    const secondHtml = renderArtifact(MARKDOWN, { designTokens: second.designTokens }).html;
    assert.equal(firstHtml, secondHtml);
    assert.match(firstHtml, /<html lang="en" data-page-theme="report" data-design-tokens>/);
    assert.match(firstHtml, /--accent:#8b1e3f/);
    assert.match(firstHtml, /--section-gap:\.9rem/);
    assert.match(firstHtml, /--radius:8px/);
    assert.match(firstHtml, /artifact-design-provenance/);
    assert.match(firstHtml, /accent&quot;:&quot;prompt/);
    assert.ok(!firstHtml.includes("design-tokens\n"));
  });
});

test("invalid project schemas and contrast are atomic lower-precedence fallbacks", () => {
  const unknown = resolveDesignTokens("report", {
    value: { schemaVersion: 1, tokens: { accent: "#005a9c", selector: "body{}" } },
  }, []);
  assert.equal(unknown.issues[0]?.code, "design-token-unknown");
  assert.equal(unknown.designTokens.active, false);
  assert.equal(unknown.designTokens.values.accent, "#b4541e");
  assert.equal(unknown.designTokens.provenance.accent, "theme");

  const contrast = resolveDesignTokens(undefined, {
    value: { schemaVersion: 1, tokens: { text: "#ffffff", surface: "#ffffff" } },
  }, []);
  assert.equal(contrast.issues[0]?.code, "design-contrast");
  assert.equal(contrast.designTokens.active, false);
  assert.equal(contrast.designTokens.values.text, "#111827");
});

test("a layout-only override preserves theme color and typography slots", () => {
  const resolved = resolveDesignTokens("report", {
    value: { schemaVersion: 1, tokens: { spacing: "compact" } },
  }, []).designTokens;
  assert.match(resolved.css, /--section-gap:\.9rem/);
  assert.ok(!resolved.css.includes("--page-bg"));
  assert.ok(!resolved.css.includes("--artifact-font"));
  const html = renderArtifact("---\ntheme: report\n---\n# Report", { designTokens: resolved }).html;
  assert.match(html, /--page-bg:#f6f0e4/);
  assert.match(html, /--artifact-heading-font:Georgia/);
});

test("token object order cannot change serialized CSS bytes", () => {
  const first = resolveDesignTokens(undefined, {
    value: { schemaVersion: 1, tokens: { font: "mono", accent: "#005a9c", radius: "soft" } },
  }, []).designTokens;
  const second = resolveDesignTokens(undefined, {
    value: { tokens: { radius: "soft", accent: "#005a9c", font: "mono" }, schemaVersion: 1 },
  }, []).designTokens;
  assert.equal(first.css, second.css);
  assert.match(first.css, /--artifact-font:ui-monospace,SFMono-Regular,Menlo,monospace/);
});

test("hostile values never enter CSS and standalone rendering shows an escaped fallback", () => {
  const cases: Array<[string, string]> = [
    ["accent", "#fff;}body{display:none}"],
    ["font", "url(https://example.com/font.woff2)"],
    ["spacing", "1rem;@import'x'"],
    ["radius", "expression(alert(1))"],
    ["density", "</style><script>alert(1)</script>"],
  ];
  for (const [name, value] of cases) {
    const markdown = `\`\`\`design-tokens\n${JSON.stringify({ schemaVersion: 1, tokens: { [name]: value } })}\n\`\`\`\n# Safe`;
    const html = renderArtifact(markdown).html;
    assert.match(html, /Design tokens failed validation/);
    assert.ok(!html.includes(value));
    assert.ok(!html.includes("<script>alert(1)</script>"));
  }
  assert.equal(renderRawHtml(MARKDOWN).html.includes("data-design-tokens"), false);
});

test("one invalid token source reports every detectable schema error", async () => {
  const markdown = '```design-tokens\n{"schemaVersion":1,"tokens":{"selector":"body","accent":"red","font":"Comic Sans","spacing":"2rem"}}\n```';
  const result = await preflightDocument(markdown);
  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    "design-token-unknown",
    "design-color",
    "design-font",
    "design-spacing",
  ]);
});

test("project discovery accepts the exact byte limit and refuses overflow and symlinks", async () => {
  await withTemp(async (root) => {
    await mkdir(join(root, ".opencode"));
    const path = join(root, DESIGN_TOKEN_FILE);
    const packet = JSON.stringify({ schemaVersion: 1, tokens: { radius: "soft" } });
    const exact = `${packet}${" ".repeat(MAX_DESIGN_TOKEN_BYTES - Buffer.byteLength(packet))}`;
    await writeFile(path, exact);
    assert.deepEqual((await loadProjectDesignTokens(root))?.value, { schemaVersion: 1, tokens: { radius: "soft" } });

    await writeFile(path, `${exact} `);
    assert.equal((await loadProjectDesignTokens(root))?.issue?.code, "design-project-too-large");

    await unlink(path);
    await writeFile(join(root, "outside.json"), packet);
    await symlink(join(root, "outside.json"), path);
    assert.equal((await loadProjectDesignTokens(root))?.issue?.code, "design-project-file");

    await rm(join(root, ".opencode"), { recursive: true, force: true });
    await mkdir(join(root, "outside-opencode"));
    await writeFile(join(root, "outside-opencode", "artifact-tokens.json"), packet);
    await symlink(join(root, "outside-opencode"), join(root, ".opencode"));
    assert.equal((await loadProjectDesignTokens(root))?.issue?.code, "design-project-path");
  });
});

test("prompt diagnostics retain absolute source lines and reject duplicate declarations", async () => {
  const invalid = "---\ntitle: Lines\n---\n\n```design-tokens\n{bad\n```";
  const result = await preflightDocument(invalid);
  assert.equal(result.diagnostics[0]?.code, "design-json");
  assert.equal(result.diagnostics[0]?.line, 5);

  const duplicate = await preflightDocument("```design-tokens\n{\"schemaVersion\":1,\"tokens\":{}}\n```\n\n```design-tokens\n{\"schemaVersion\":1,\"tokens\":{}}\n```");
  assert.equal(duplicate.diagnostics[0]?.code, "design-prompt-duplicate");
});

test("plugin and CLI apply project tokens before permission and publication", async () => {
  await withTemp(async (root) => {
    await writeProject(root, { schemaVersion: 1, tokens: { spacing: "compact", font: "mono" } });
    const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
    assert.ok(publish);
    const asked: Array<Parameters<ToolContext["ask"]>[0]> = [];
    const context: ToolContext = {
      sessionID: "design", messageID: "design", agent: "test", directory: root, worktree: root,
      abort: new AbortController().signal, metadata: () => {}, ask: async (input) => { asked.push(input); },
    };
    assert.match(String(await publish.execute({ markdown: MARKDOWN }, context)), /Artifact published/);
    assert.equal(asked.length, 1);
    const pluginHtml = await readFile(join(root, ".opencode", "artifacts", "token-surface.html"), "utf8");
    assert.match(pluginHtml, /--section-gap:\.9rem/);
    assert.match(pluginHtml, /--accent:#8b1e3f/);

    const input = join(root, "tokens.md");
    const output = join(root, "tokens.html");
    await writeFile(input, MARKDOWN);
    await execFileAsync(process.execPath, [join(ROOT, "src", "cli.ts"), "render", input, "-o", output], { cwd: root });
    const cliHtml = await readFile(output, "utf8");
    assert.match(cliHtml, /--section-gap:\.9rem/);
    assert.match(cliHtml, /--accent:#8b1e3f/);
    assert.match(cliHtml, /artifact-design-provenance/);
  });
});

test("invalid project tokens refuse plugin permission and writes without partial CSS", async () => {
  await withTemp(async (root) => {
    await writeProject(root, { schemaVersion: 1, tokens: { accent: "#005a9c", css: "body{display:none}" } });
    const publish = (await ArtifactsPlugin({} as unknown as PluginInput)).tool?.artifact_publish;
    assert.ok(publish);
    let asked = false;
    const context: ToolContext = {
      sessionID: "invalid-design", messageID: "invalid-design", agent: "test", directory: root, worktree: root,
      abort: new AbortController().signal, metadata: () => {}, ask: async () => { asked = true; },
    };
    const output = String(await publish.execute({ markdown: "# Refused" }, context));
    assert.match(output, /design-token-unknown/);
    assert.equal(asked, false);
    await assert.rejects(readFile(join(root, ".opencode", "artifacts", "refused.html")));
  });
});
