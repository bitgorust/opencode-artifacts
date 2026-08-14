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

## Roadmap

- `HostedPublisher` — auth + org sharing links (the one structural gap vs Claude Code Artifacts)
- Mermaid blocks, syntax highlighting, PDF export

## Parity with Claude Code Artifacts

See [`docs/claude-code-comparison.md`](docs/claude-code-comparison.md) for the full feature
matrix, verified QA log, and screenshots (`docs/evidence/`). Everything achievable without
hosted infrastructure is at parity; sharing links need `HostedPublisher`.

## License

MIT
