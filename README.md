# opencode-artifacts

Publish [OpenCode](https://opencode.ai) session output as **self-contained, interactive HTML artifact pages** — dashboards, PR walkthroughs, incident timelines, comparisons — anything easier to see as a page than to read as terminal text.

Inspired by Claude Code's Artifacts, rebuilt as a local-first, open-source OpenCode plugin.

## How it works

```
Markdown + chart specs  ──▶  fixed renderer  ──▶  ONE self-contained .html  ──▶  Publisher
(authoring layer)          (this package)        (inline CSS/JS, strict CSP)     (v1: local file)
```

- **Authoring layer is Markdown**, not raw HTML — cheap for the model to write, diff-friendly, hard to get wrong. Charts are declared as JSON specs in fenced blocks.
- **The renderer is fixed, trusted code.** It inlines only the chart runtimes actually used (Vega/Vega-Lite via vega-embed, or ECharts), applies a strict CSP, and enforces a 15 MiB size cap.
- **Publisher is an interface.** v1 ships `FilePublisher` (writes `.opencode/artifacts/<slug>.html` with optional versioned history). A localhost live-reload server or a hosted sharing service can be added later without touching the renderer.

## Install (OpenCode plugin)

```bash
npm install opencode-artifacts
```

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-artifacts"]
}
```

Then ask in a session, e.g.:

> Summarize this incident investigation and publish it as an artifact with a timeline table and an error-rate chart.

The model calls the `artifact_publish` tool with Markdown like:

````markdown
---
title: Incident 4172 — Checkout latency spike
icon: 🚨
---

# Timeline
...

```vega-lite
{ "data": { "values": [...] }, "mark": "bar", "encoding": { ... } }
```
````

and gets back `Artifact published to <worktree>/.opencode/artifacts/incident-4172-checkout-latency-spike.html`.

### Proactive use (recommended)

Install the bundled skill so the agent publishes on its own when output suits a page:

```bash
cp -r skills/artifact-pages ~/.agents/skills/   # or your project's .agents/skills/
```

It encodes the same trigger Claude Code uses ("a deliverable with an audience is not fully
delivered while it lives only in terminal scrollback"), the component cheat sheet, and the
page-naming rules — distilled from Claude Code 2.1.232's actual `artifact-design` skill and
Artifact tool description (see `docs/claude-code-comparison.md`).

### Tool: `artifact_publish`

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `markdown` | string (required) | — | Full Markdown source of the page |
| `title` | string? | frontmatter `title` | Title override |
| `open` | boolean? | `false` | Open in the system browser after publishing |
| `version` | boolean? | `false` | Also keep `<slug>.v<N>.html` history files |
| `format` | `"markdown" \| "html"`? | `"markdown"` | `"html"` embeds the input as raw trusted HTML |

Publishing asks for permission once (`artifact_publish`), writes the page, updates a
`manifest.json`, and regenerates a local **gallery** at `.opencode/artifacts/index.html`.
Every artifact footer links back to the gallery and shows its version and update time.

## CLI

```bash
npm install -g opencode-artifacts

opencode-artifacts render examples/incident-report.md --open --version
opencode-artifacts serve                       # http://127.0.0.1:4173, pages live-reload on republish
opencode-artifacts restore <slug> --version 1  # point the stable page back at an older version
opencode-artifacts latest --open               # reopen the most recently updated artifact
```

`serve` relaxes `connect-src` to `'self'` on the served copy only (needed for the
live-reload EventSource); the files on disk keep `connect-src 'none'`.

## Authoring format

- **Frontmatter** (optional): `title: ...`, `icon: ...` between `---` fences. Only `key: value` lines; anything else is ignored with a warning.
- **Chart blocks**: fenced code blocks tagged `vega-lite`, `vega`, or `echarts`, containing one JSON spec. Vega-Lite specs are compiled to Vega at render time; charts render with Vega's CSP-safe interpreter (`ast: true`).
- **Component blocks** (JSON in a fence, see `docs/component-spec.md`):
  - ```` ```stats ```` — metric cards row: `[{label, value, delta?, direction?, tone?, emphasis?}]`
  - ```` ```timeline ```` — vertical incident timeline: `[{time, title, detail?, tone?}]`
  - ```` ```findings ```` — severity-coded findings: `[{severity, title, location?, detail?}]`
  - ```` ```compare ```` — variant cards: `[{title, pill?, annotations?, tradeoff?}]`
  - ```` ```callout ```` — tinted insight card: `{tone, title?, body?}`
  - ```` ```progress ```` — progress bar: `{label?, done, total}`
  - ```` ```diff ```` — annotated unified diff (lines starting `## note:` become annotations)
  - ```` ```copy ```` — copy-to-clipboard button: `{label?, text}` (fixed JS; text rides in a `<template>`, newlines preserved)
  - ```` ```mermaid ```` — diagram source (graph/sequence/ER/...), rendered live with the inline mermaid runtime
  - ```` ```decisions ```` — workshop decision rows: `{title?, questions: [{id, question, options: [{id, label, note?}]}]}`. Selections persist to localStorage; under `serve` they also POST to the server, and the session reads them back with the `artifact_state` tool or `opencode-artifacts state <slug>`.
- **Interactive controls without custom JS**: vega-lite `params` with `bind` render as native sliders/dropdowns and re-render the chart live; echarts `dataZoom`/toolbox options work as-is. See `examples/patterns/tune-controls.md`.
- **Stale-version guard**: `artifact_publish` results include a content `hash`; pass it back as `expectedHash` on update and the publish is refused if someone changed the artifact in between.
- **Sensitive-content guard**: publish is blocked when the source contains credential-looking strings (AWS/GitHub/Anthropic/OpenAI keys, private keys, bearer tokens, password literals); override with `force: true` / `--force`.
- **Comments**: every artifact page has a built-in comment flow — select text → "Comment" → thread dock. Under `serve`, threads persist server-side (`.state/<slug>.comments.json`); the session reads/resolves them with the `artifact_comments` tool.
- **Shared mini-DB** (raw-HTML pages, under `serve`): `opencodeArtifacts.db.get/list/set/remove(slug-scoped collections)` — a fixed JS bridge over `/__db/` endpoints.
- **Live data bridge** (raw-HTML pages, under `serve`): publish with `dataSources: [{name, command, args}]` (registered at publish time, not viewer-controlled); the page polls `opencodeArtifacts.data(name)`; the server runs the allow-listed command with a 5s timeout and 5s cache.
- **Gallery subtitles**: frontmatter `description:` becomes the gallery card's one-line subtitle.
- **Markdown extras**: GitHub alerts (`> [!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`), task lists (`- [x]`), auto heading anchors, and `##` sections become white cards.
- **Broken specs don't break the page** — the slot shows an inline error box instead.
- **Everything else** is standard Markdown (tables, code blocks, links, images as data URIs).

Worked examples for the five canonical patterns live in `examples/patterns/` with rendered
screenshots in `docs/evidence/patterns/`.

## Security model

- Raw HTML in Markdown is never passed through (`markdown-it` with `html: false`).
- Every page ships with `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'` — no external requests at view time, no `unsafe-eval`.
- Embedded chart JSON is `\u003c`-escaped so a spec cannot break out of its `<script>` tag.
- Pages over 15 MiB are rejected before anything is written.

## Development

```bash
npm install
npm test        # node --test, no framework
npm run build   # tsc -> dist/
```

## Cost-free public sharing (GitHub Pages)

Publish to a public GitHub Pages site — git history doubles as version history and audit log:

```bash
opencode-artifacts deploy --repo <you>/artifacts            # one-off sync of the local gallery
# or per publish, in OpenCode: artifact_publish with deploy: true, repo: "<you>/artifacts"
```

The repo is created (public) on first use, Pages is enabled automatically, and local state
(`.state`/`.db`/`.datasources`) is never uploaded. Every deploy is a commit
(`publish <slug> v<N>`), so the repo's log is the audit trail. Live demo:
`https://bitgorust.github.io/artifacts/` (see `docs/evidence/live-*.png`).

For authenticated/org sharing, the next step is the same publisher shape against Cloudflare
Pages + Workers + KV + Access (all free tier) — tracked in the roadmap.

## Roadmap

- `HostedPublisher` (authenticated tier): Cloudflare Pages + Workers + KV + Access
- Syntax highlighting, PDF export

## Parity with Claude Code Artifacts

See [`docs/claude-code-comparison.md`](docs/claude-code-comparison.md) for the full feature
matrix, verified QA log, and screenshots (`docs/evidence/`). Everything achievable without
hosted infrastructure is at parity; sharing links need `HostedPublisher`.

## License

MIT
