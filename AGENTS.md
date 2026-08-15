# AGENTS.md

Guidance for coding agents working in this repository. Humans start at README.md.

## Commands

- `npm test` — run the full suite (node --test, no framework; must be green before commit)
- `npm run build` — compile TypeScript to `dist/` (tsc, must exit 0)
- `npm run check` — structural repo assertions (packaging, README, security invariants)
- `node dist/cli.js render examples/patterns/<name>.md -o /tmp/x.html` — render a sample page
- `npm pack --dry-run` — review what ships to npm

## Project knowledge

- **Stack:** TypeScript (strict, ESM, module NodeNext), Node ≥ 24 (tests run on native type
  stripping — no test framework), markdown-it, vega/vega-lite/vega-embed, echarts, mermaid.
- **Structure:**
  - `src/` — all source; the pipeline is `markdown.ts` (parse) → `components.ts` + `render.ts`
    (render) → `publisher.ts` / `github-pages.ts` / `cloudflare-publisher.ts` (publish);
    `serve.ts` + `served-html.ts` are the local server; `cloudflare/` is the hosted worker;
    `plugin.ts` is the OpenCode entry; `cli.ts` the standalone CLI.
  - `test/` — one file per unit, `node:test` + `assert/strict`.
  - `skills/artifact-pages/` — the agent skill (SKILL.md + reference/, progressive
    disclosure per docs/engineering-principles.md §11).
  - `docs/` — spec, component reference, parity docs; `docs/evidence/` — QA screenshots.
- **Import style:** relative imports carry the `.ts` extension; tsc rewrites them on build.
  No constructor parameter properties (type stripper rejects them) — declare fields
  explicitly.

## Boundaries

- ✅ **Always:** add a test in the same commit as the behavior; keep `npm run check` green;
  escape user text with `escapeHtmlText`; add components as new fence kinds in
  `components.ts`; put QA screenshots in `docs/evidence/` for UI-affecting changes.
- ⚠️ **Ask first:** new dependencies; changes to the CSP string in `render.ts`; changes to
  the `Publisher` interface; anything touching `plugin.ts` tool args (that's a public API).
- 🚫 **Never:** weaken the CSP (no `unsafe-eval`, on-disk files keep `connect-src 'none'`);
  raw-HTML passthrough in markdown mode; `as any` / `@ts-ignore`; secrets in commits;
  deleting a failing test to go green; version numbers pinned inside docs prose.

## Conventions

- Conventional Commits, atomic. SemVer; pre-1.0 minors may add tool args, never remove.
- Rules live in `docs/engineering-principles.md` — if you change behavior it governs, update
  it in the same commit.
