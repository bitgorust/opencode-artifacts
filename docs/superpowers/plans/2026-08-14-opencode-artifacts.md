# OpenCode Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (inline execution chosen: user requested immediate delivery; codebase is small and fully in-context).

**Goal:** Ship `opencode-artifacts` v0.1.0 — an OpenCode plugin + CLI that renders Markdown-with-chart-specs into one self-contained interactive HTML artifact.

**Architecture:** Authoring (Markdown + frontmatter + fenced chart specs) → fixed renderer (markdown-it, conditional runtime inlining, strict CSP, 15 MiB cap) → `Publisher` interface with `FilePublisher` v1. Spec: `docs/superpowers/specs/2026-08-14-opencode-artifacts-design.md`.

**Tech Stack:** TypeScript (NodeNext, `rewriteRelativeImportExtensions` so `node --test` runs src directly and tsc emits dist), markdown-it, vega + vega-lite (compile at render time) + vega-embed, echarts (file-read only), node:test.

**Locked interface signatures (used across all tasks):**

```ts
// markdown.ts
export interface Frontmatter { title?: string; icon?: string }
export interface ChartSpec { kind: "vega-lite" | "vega" | "echarts"; json: string }
export interface ParsedDocument { meta: Frontmatter; bodyHtml: string; charts: ChartSpec[]; warnings: string[] }
export function parseDocument(source: string): ParsedDocument

// render.ts
export class ArtifactTooLargeError extends Error {}
export interface RenderedArtifact { html: string; meta: Frontmatter; chartCount: number }
export function renderArtifact(markdown: string, options?: { maxBytes?: number }): RenderedArtifact

// runtime.ts
export type RuntimeName = "vega" | "vega-embed" | "echarts"
export function runtimeBundle(name: RuntimeName): string   // wrapped in /* runtime:<name> */ markers

// publisher.ts
export function slugify(title: string): string
export interface PublishInput { slug: string; html: string; version?: boolean }
export interface PublishResult { path: string; version: number }
export interface Publisher { publish(input: PublishInput): Promise<PublishResult> }
export class FilePublisher implements Publisher { constructor(dir: string) }

// open.ts
export function openFile(path: string): void   // best-effort, never throws

// plugin.ts
export const ArtifactsPlugin: Plugin            // tool key: artifact_publish
export default ArtifactsPlugin
```

**Security invariants (tests must prove):** raw HTML in markdown is escaped; CSP meta `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'`; embedded chart JSON escapes `<` as `\u003c` (no `</script>` breakout); runtimes inlined only when used; oversize throws `ArtifactTooLargeError` and nothing is written.

---

### Task 1: markdown.ts + tests

**Files:** Create `src/markdown.ts`, `test/markdown.test.ts`

- [ ] Write failing tests: frontmatter parse (present/absent/malformed), chart fence extraction in order (```vega-lite/```vega/```echarts → `<div class="chart" data-chart-index="N">`), raw `<script>` in prose escaped by markdown-it, unknown fence renders as plain code block.
- [ ] Implement: minimal `key: value` frontmatter parser (only `title`, `icon`; malformed → warning, not fatal); markdown-it `{ html: false, linkify: true }`; custom `renderer.rules.fence` that diverts chart fences to placeholders and falls back to escaped `<pre><code>` for everything else.
- [ ] `node --test test/markdown.test.ts` green.
- [ ] Commit `feat: markdown authoring layer with chart spec extraction`.

### Task 2: runtime.ts + render.ts + tests

**Files:** Create `src/runtime.ts`, `src/render.ts`, `test/render.test.ts`

- [ ] Write failing tests: output contains CSP meta + escaped `<title>`; no charts → no `runtime:vega` marker; vega-lite chart → contains `runtime:vega`, `runtime:vega-embed`, boot script with `vegaEmbed`, and compiled spec data; echarts chart → `runtime:echarts` + `echarts.init`; bad chart JSON → `<div class="chart-error">` and page still returned; spec containing `</script>` → embedded JSON has `\u003c` instead; `maxBytes: 64` → throws `ArtifactTooLargeError`.
- [ ] Implement `runtime.ts`: `createRequire` resolve of `vega/build/vega.min.js`, `vega-embed/build/vega-embed.min.js`, `echarts/dist/echarts.min.js`, memoized, wrapped as `/* runtime:<name> */\n<code>`.
- [ ] Implement `render.ts`: parse → per chart `JSON.parse` (vega-lite then `compile()` from vega-lite) with per-chart try/catch → error entry; assemble shell (CSP meta, inline CSS, header with icon+title, body, `<script>window.__ARTIFACT_CHARTS__=<json-with-\u003c-escaping></script>`, needed runtimes, boot script that mounts `vegaEmbed(el, spec, {actions:false})` / `echarts.init(el).setOption(spec)` or fills error boxes); byte-length cap check last.
- [ ] `node --test test/render.test.ts` green.
- [ ] Commit `feat: single-file HTML renderer with CSP and conditional chart runtimes`.

### Task 3: publisher.ts + open.ts + tests

**Files:** Create `src/publisher.ts`, `src/open.ts`, `test/publisher.test.ts`

- [ ] Write failing tests in tmpdir: `slugify("Deploy failures: Q3/Q4!") === "deploy-failures-q3-q4"`; publish writes exact bytes to `<dir>/deploy-failures-q3-q4.html`; second publish with `version: true` writes `.v2.html` AND refreshes stable path; version numbering continues from existing files.
- [ ] Implement `slugify` (lowercase, non-alnum → `-`, collapse, trim, fallback `"artifact"`), `FilePublisher` (`mkdir -p`, scan `slug.v*.html` for next N), `openFile` (`spawn` detached: darwin `open`, win32 `cmd /c start ""`, else `xdg-open`; `stdio:"ignore"`, `.unref()`, try/catch swallow).
- [ ] `node --test test/publisher.test.ts` green.
- [ ] Commit `feat: file publisher with stable path and version history`.

### Task 4: plugin.ts + cli.ts

**Files:** Create `src/plugin.ts`, `src/cli.ts`, Modify `package.json` (nothing — verify exports/bin match)

- [ ] `plugin.ts`: `ArtifactsPlugin` per locked signature; tool `artifact_publish` args `{ markdown: string, title?, open?, version? }` via `tool.schema`; publisher rooted at `join(ctx.worktree, ".opencode", "artifacts")`; returns `"Artifact published to <path>"`; `ArtifactTooLargeError` surfaces as returned error text.
- [ ] `cli.ts`: `#!/usr/bin/env node`; `render <input.md> [-o <out.html>] [--open] [--title <t>]`; default out = `<cwd>/<slug>.html`; prints path.
- [ ] `npm run build` exits 0; `node dist/cli.js render examples/incident-report.md -o /tmp/artifact.html` prints path and file exists.
- [ ] Commit `feat: opencode plugin tool and standalone CLI`.

### Task 5: example + README + verify + publish

**Files:** Create `examples/incident-report.md`, `README.md`

- [ ] Example exercises frontmatter, prose, one vega-lite bar chart, one echarts line chart, one intentionally broken spec (shows error box).
- [ ] README: what/why, install in `opencode.json` (`"plugin": ["opencode-artifacts"]`), tool usage prompt example, CLI usage, format reference, security model, roadmap (LocalServerPublisher/HostedPublisher), MIT.
- [ ] Full gate: `npm test` all green, `npm run build` exit 0, render example → grep artifact for CSP + both runtimes + error box.
- [ ] Commit `docs: readme and example artifact`.
- [ ] `gh repo create opencode-artifacts --public --source . --push` → report URL.
