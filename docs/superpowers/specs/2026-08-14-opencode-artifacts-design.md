# OpenCode Artifacts — Design Spec

Date: 2026-08-14
Status: Approved (user confirmed direction, requested immediate implementation + open source)

## Goal

Give OpenCode a Claude Code "Artifacts"-like capability: turn session output into a
self-contained, interactive HTML page. v1 is local-first and private by default;
the architecture leaves room for a localhost live server and a hosted service later.

## Agreed Architecture

Pipeline: **Capture → Author → Render → Publish → (later) Share**

1. **Authoring layer = Markdown + JSON chart specs.** The model writes Markdown with
   optional YAML-subset frontmatter (`title`, `icon`) and fenced code blocks carrying
   declarative chart specs (```vega-lite, ```vega, ```echarts). Cheap to generate,
   diff-friendly, low error rate.
2. **Renderer = fixed, trusted code.** Compiles the authoring document into ONE
   self-contained HTML file: inlined CSS, inlined chart runtimes (only the runtimes
   actually used), all data embedded. No external requests at view time.
3. **Publisher = pluggable interface.** v1 ships `FilePublisher` (writes
   `.opencode/artifacts/<slug>.html`, optional auto-open). `LocalServerPublisher`
   (SSE live updates) and `HostedPublisher` (auth + org sharing) are future adapters
   behind the same interface.
4. **Security defaults:** raw HTML in Markdown is NOT passed through; markdown-it
   `html: false`; strict CSP (`default-src 'none'; script-src 'unsafe-inline';
   style-src 'unsafe-inline'; img-src data:; connect-src 'none'`); rendered size cap
   (default 15 MiB) with a hard error.

## Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/markdown.ts` | Parse frontmatter + markdown; extract chart specs; produce body HTML | markdown-it |
| `src/runtime.ts` | Locate + read browser bundles (vega, vega-embed, echarts) from package deps; cache | node:fs |
| `src/render.ts` | Assemble final HTML document: shell, CSP, CSS, body, specs, boot script; enforce size cap | markdown.ts, runtime.ts, vega-lite (compile) |
| `src/publisher.ts` | `Publisher` interface + `FilePublisher` (slugify, versioned filenames, write, optional open) | node:fs |
| `src/plugin.ts` | OpenCode plugin entry; exposes `artifact_publish` tool | @opencode-ai/plugin |
| `src/cli.ts` | Standalone `opencode-artifacts render input.md [-o out.html] [--open]` | render.ts, publisher.ts |

## Data Flow (plugin path)

1. Model calls tool `artifact_publish({ markdown, title?, open? })`.
2. Plugin resolves output dir: `<worktree>/.opencode/artifacts/`.
3. `render.ts` builds the HTML document; size cap checked.
4. `FilePublisher` writes `<slug>.html` (or `<slug>.v<N>.html` when `version` asked).
5. Tool returns the absolute file path (and opens it when `open: true` via `$`).

## Error Handling

- Invalid frontmatter → ignored with warning in output metadata, never fatal.
- Invalid chart spec JSON → render an inline error box in place of the chart (page still ships).
- vega-lite compile failure → same inline error box.
- Size cap exceeded → throw `ArtifactTooLargeError`; tool returns the message, nothing written.
- Unwritable output dir → tool returns the underlying fs error text.

## Testing

- `node --test` on `test/*.test.ts` (Node 24 native type stripping, no test framework dep).
- markdown: frontmatter parse, chart block extraction, raw-HTML escaping.
- render: contains CSP meta, title, inlined runtime only when charts present, spec JSON embedded, size cap throws.
- publisher: slugify rules, version increments, file written with exact bytes.

## Explicit Non-Goals (v1)

- No backend, no auth, no sharing links, no live reload.
- No Mermaid (bundle weight); revisit after v1.
- No syntax highlighting library (plain styled `<pre>`); revisit after v1.
- No raw HTML passthrough in Markdown.

## Open Source Packaging

- MIT license, npm package `opencode-artifacts`, public GitHub repo.
- Peer dependency on `@opencode-ai/plugin`; README documents install via `opencode.json` `plugin` array and CLI usage.
