# AGENTS.md

Guidance for coding agents working in this repository. Humans start at README.md.

Read `docs/engineering-principles.md` before non-trivial work — it is the living rulebook.
Rules marked `[check:<id>]` are machine-enforced by `scripts/checks.ts`; a new principle
becomes enforceable by adding its registry entry and tagging it — the consistency assertion
fails if either side is missing.

## Commands

- `npm test` — run the full suite (node --test, no framework; must be green before commit)
- `npm run build` — compile TypeScript to `dist/` (tsc, must exit 0)
- `npm run check` — structural repo assertions (packaging, README, security invariants)
- `npm run spec -- new <id> --lane standard|high-risk --title "..."` — scaffold a behavior
  change packet; use `validate <id> --phase ...` and `archive <id>` for its gates
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
  - `specs/current/` — behavior known to ship; `specs/changes/` — active deltas;
    `specs/archive/` — verified decision history. See `specs/README.md`.
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

## Spec-anchored changes

- **Trivial:** no observable behavior or governed invariant changes, or a bug restores an
  already explicit current spec. A packet is unnecessary.
- **Standard:** observable behavior, a public contract, or a normative requirement changes.
  Create a standard packet.
- **High-risk:** security, privacy, authorization, concurrency, durability, migration,
  destructive action, public compatibility, or an irreversible decision changes. Create a
  high-risk packet with `design.md`.
- Do not implement a standard/high-risk packet while it contains `[NEEDS CLARIFICATION]` or
  before human approval is recorded in `change.json`.
- If evidence contradicts a packet, amend and reapprove it. Update the affected
  `specs/current/*.spec.md` in the same change, record exact evidence, then archive.
