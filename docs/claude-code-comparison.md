# Parity comparison: Claude Code Artifacts vs opencode-artifacts

Full capability inventory with binary evidence: [`docs/claude-code-inventory.md`](claude-code-inventory.md).

Normative baseline: the current official
[Claude Code Artifacts documentation](https://code.claude.com/docs/en/artifacts), its
[tools](https://code.claude.com/docs/en/tools-reference),
[settings](https://code.claude.com/docs/en/settings),
[environment](https://code.claude.com/docs/en/env-vars), and
[availability](https://code.claude.com/docs/en/feature-availability) references, rechecked
through the official documentation index on 2026-08-15. The
[launch post](https://claude.com/blog/artifacts-in-claude-code) is historical context: its
Team/Enterprise-only, no-public-sharing beta statements have been superseded by the current
guide.
The official viewer screenshot is retained at `docs/references/claude-artifact-viewer.png`.
Binary-string research is supplemental and does not establish official behavior or parity.
The target contract and honest release levels are in [`docs/product-spec.md`](product-spec.md)
and [`docs/roadmap.md`](roadmap.md).

Local reference evidence is explicit rather than inferred: OpenCode 1.18.18 loaded this
checkout and registered all four tools, while a healthy native Claude Code 2.1.233 install
was inspected without Claude credentials. See the
[OpenCode host probe](evidence/opencode-host-verification.md) and
[Claude Code host probe](evidence/claude-code-host-verification.md). Because Claude requires
`/login` subscription authentication for Artifacts, its hosted publish/share/connector path
was not exercised on this machine.

## Page quality

Claude's page quality comes from a built-in design skill producing raw HTML. Our fixed
renderer covers comparable structured-report patterns: card-based layout on a gray-blue canvas, metric stat
cards with delta pills, tinted insight callouts, vertical timelines, severity-coded findings,
annotated diffs, variant comparison cards, progress bars, and GitHub-style alerts. The six
canonical patterns from the official docs are reproduced in `examples/patterns/` and verified
by browser QA with zero console errors — screenshots in `docs/evidence/patterns/`:

- `dashboard.png` — stats row + chart + insight callout (compare with the official viewer screenshot)
- `incident.png` — stats + timeline + area chart + root-cause callout + task list
- `pr-walkthrough.png` — severity findings + annotated diff + warning alert
- `release-checklist.png` — progress bar + task lists + important alert
- `compare-layouts.png` — variant cards with pills, numbered annotations, tradeoffs
- `tune-controls.png` — live vega-lite param sliders + echarts dataZoom + copy button (v0.4)

Interactive patterns are covered inside the fixed renderer: chart-bound controls via vega-lite
`params.bind` / echarts `dataZoom` (browser-verified: moving a slider re-rendered the chart),
and export-back-to-session via the `copy` component (browser-verified clipboard write).
Only free-form per-page JS (e.g. drag-drop boards) stays in raw-HTML mode.

## Feature matrix

| Capability | Claude Code | opencode-artifacts | Evidence |
|---|---|---|---|
| Single self-contained page (inline CSS/JS, no backend) | ✅ | ✅ | `test/render.test.ts`, `docs/evidence/artifact-page.png` |
| Strict CSP and bounded external access | ✅ Google Fonts plus declared connector calls are the documented exceptions | ✅ stricter offline file (`connect-src 'none'`); served bridges are explicit | render test "plain markdown artifact carries CSP" |
| Size cap | ✅ 16 MiB | ✅ 15 MiB (configurable), hard error before write | render test "size cap throws" |
| Markdown **and** raw HTML authoring | ✅ | ✅ (`format: markdown \| html`) | render test "renderRawHtml" |
| Interactive charts | ✅ | ✅ vega-lite / vega / echarts, CSP-safe interpreter (`ast: true`, no `unsafe-eval`) | browser QA: both canvases mounted, 0 console errors |
| Broken-chart resilience | not documented | ✅ inline error box, page still ships | `artifact-page.png` (red box), render test |
| Title + emoji picked by the model | ✅ | ✅ + emoji as SVG favicon | `artifact-page.png` header |
| Republish updates the same URL | ✅ | 🟡 stable `<slug>.html` path and local SSE; identity is title/slug-coupled and hosted open pages do not refresh live | local live-reload QA; product spec `LIFE-01`, `HOST-05` |
| Version history + restore | ✅ every publish is a version | 🟡 numbered files and restore exist, but history is opt-in | `test/gallery.test.ts`; product spec `LIFE-02` |
| Gallery of all artifacts | ✅ hosted on claude.ai | ✅ local `index.html`, regenerated on every publish | `docs/evidence/gallery.png` |
| Permission prompt before publishing | ✅ | ✅ `ctx.ask({ permission: "artifact_publish", ... })` | `test/plugin.test.ts` |
| Reopen latest artifact | ✅ `Ctrl+]` | ✅ `opencode-artifacts latest --open` | CLI smoke run |
| Auto-open in browser | ✅ by default, environment-configurable | 🟡 explicit `open: true` / `--open`, not the default | `src/open.ts` |
| Share links (org / public) | ✅ private, org, editor, and public policies | 🟡 explicit public snapshots exist; Cloudflare Access is manual and there is no built-in audience/role/version policy | GitHub/Cloudflare publishers; roadmap phase 5 |
| MCP connector live data at view time | ✅ viewer-scoped grants and identity | ❌ local fixed-command datasources are not hosted viewer-scoped MCP connectors | product spec `CONN-01`–`CONN-07` |
| Organization controls and lifecycle API | ✅ independent artifact/connector/public-sharing controls, role scopes, retention, audit events, and Compliance API | ❌ no control plane or administrative API | product spec `HOST-07`, `HOST-09` |
| Sandboxed hosted content boundary | ✅ viewer content is served from `*.claudeusercontent.com` | 🟡 strong CSP, but the Cloudflare page and control API currently share one Worker origin | product spec `HOST-10` |
| Embedded local images/assets | ✅ data URIs under the single-page CSP | 🟡 data URIs can render, but there is no safe worktree asset ingestion pipeline | product spec `RENDER-04` |
| Authoring token cost | high (model writes styled HTML) | lower by design (model writes Markdown + JSON specs; fixed renderer owns the HTML) | spec §Agreed Architecture |

## Verified QA log (2026-08-14)

1. `node --test test/*.test.ts` → 26/26 pass; `tsc` build exit 0.
2. Served `.opencode/artifacts/` via `opencode-artifacts serve`, opened the incident demo:
   - vega canvas: 1, echarts canvas: 1, error box: 1, console errors: 0.
   - Footer: `Published by opencode-artifacts · v1 · updated … · Gallery`.
3. Live reload: appended `LIVE-RELOAD-PROOF-7X9` to the source Markdown, republished via CLI;
   the already-open browser page refreshed over SSE and the marker appeared — no manual reload.
4. Two CSP issues were caught by this browser QA and fixed with regression tests:
   vega needs `ast: true` (avoids `unsafe-eval`), and serve mode must relax `connect-src` to
   `'self'` for EventSource while on-disk files keep `connect-src 'none'`.

## Screenshots

- `docs/evidence/artifact-page.png` — full artifact page (header, timeline table, both charts, error box, footer).
- `docs/evidence/gallery.png` — auto-generated gallery.

## Supplemental capability inventory (non-normative binary research)

The current public docs cover the supported publishing, sharing, connector, and governance
surface. A focused survey of the locally installed Claude Code 2.1.233 binary additionally
exposes internal or gated action families. These names are useful research leads, not public
contracts:

| Capability | Evidence in binary | Our status |
|---|---|---|
| Publish / update same URL, versions, gallery, share menu, permission prompt, emoji favicon, auto-open, live MCP connectors at view time | public docs + tool strings | 🟡 local publishing/gallery are functional; immutable-by-default versions, audience controls, hosted live updates, and viewer-identity connectors remain roadmap work |
| **artifact-design skill** (mandatory design pass before every publish) | `artifact-design` SKILL_MD | ✅ adapted into `skills/artifact-pages` |
| **Mermaid diagrams** | `artifact-diagramming` skill, mermaid composer | ✅ `mermaid` fence (v0.5), runtime inlined on use |
| **Plan artifacts** (offer to review the implementation plan as a page) | `publishPlanArtifact`, plan consent ask | ✅ publish the plan md — `examples/patterns/plan.md` (v0.5) |
| **Comments on artifacts** (threads with span quotes, resolve, auto-responder pipeline) | `CLAUDE_CODE_ARTIFACT_COMMENTS*`, comment-pipeline prompts | 🟡 local analog (v0.6): select-text → thread dock, serve-persisted, `artifact_comments` read/resolve; no identity/multi-user |
| **Workshop** (decide-and-revise loop: page carries open decisions, reader answers on the page, session reads answers back via `read_decisions`) | workshop skill, decision component | ✅ `decisions` component + serve state persistence + `artifact_state` readback (v0.5) |
| **Shared per-artifact database** (`read_db`/`write_db`, collections/docs/queries; state shared across viewers) | db action strings | 🟡 local collections DB (v0.6): `/__db` endpoints + `opencodeArtifacts.db` bridge; single-user |
| **Runtime capabilities** (`window.claude.*`: live data, shared state, file downloads, self-update; declared per page, roster-gated) | `artifact-capabilities` skill, capabilities prompt | 🟡 live-data bridge (v0.6): publish-registered datasources polled via `opencodeArtifacts.data`; no downloads/self-update |
| **watch/unwatch/status** (session gets woken when another session republishes or comments) | webhook triggers, watch actions | 🟡 viewer-side analog exists (`serve` SSE); session-side wake is structural |
| **Multi-file publish experiments** (`files` map: separate CSS/JS/data/images) | rollout/gating strings | ➖ skipped by design — our portable artifact stays one file |
| **Stale-version guard** (refuse to publish over a version this session hasn't seen) | `stale_version_guard` errors | ✅ content-hash `expectedHash` (v0.5) |
| **Sensitive-delta guard** (block live-shared republishes that expose new sensitive content) | permission analysis strings | 🟡 credential-pattern scan blocks publish/deploy unless `force`; it is not semantic PII analysis or a sensitive delta review |
| **live-edit action** | "not available in this build" | ➖ gated upstream too |

## Gap closure

The previous tactical list in this file became stale as features shipped. The active,
dependency-ordered plan is now [`docs/roadmap.md`](roadmap.md). Its first priorities are
durable identity and unconditional revisions, cross-process/crash-safe transactions, embedded
local assets, and packed-package OpenCode compatibility tests. Authenticated sharing and
viewer-scoped connectors follow only after those foundations pass.

## Public artifact quality survey (2026-08-15)

Galleries exist — [madewithclaude.com](https://madewithclaude.com/),
[awesome-claude-artifacts](https://github.com/madewithclaude/awesome-claude-artifacts),
claudeartifacts.club, [claudeatplay.com](https://claudeatplay.com/) — but claude.ai-hosted
artifact pages are IP-region-blocked from this machine (the shell redirects; the
`claudeusercontent.com` content host itself answers, so this is geo-policy, not a technical
limit). Reachable real samples reviewed in a browser:

- **claudeatplay.com** (self-hosted gallery of Claude-made interactive pieces): editorial
  ceiling — bespoke dark canvas, display serif, Roman-numeral indices, per-piece custom
  canvas animations. Above our fixed renderer; reachable for us only via raw-HTML mode.
- **tools.simonwillison.net** (Claude-artifact-built utility tools, e.g. the SQLite Query
  Explainer): the *everyday* artifact register — gray ground, white card, system sans, blue
  buttons. Visually indistinguishable from our `default` theme. The glamour samples are
  curated; the median output looks like this.

Subjective quality assessment from those reachable public samples (not an authenticated
same-prompt benchmark):

| Task class | Same quality as Claude? |
|---|---|
| Dashboards, reports, incidents, timelines, checklists, comparisons, data tables | Comparable structured coverage with a consistent renderer floor; see `docs/evidence/patterns/` |
| Explainers with bespoke SVG diagrams | Partially — mermaid yes; hand-tuned SVG needs `format: "html"` |
| Interactive playgrounds (canvas sims, 3D, pyodide tools, single-purpose editors) | Only via raw-HTML mode; quality then tracks the model, same as theirs |
| Editorial bespoke pages (claudeatplay class) | Only via raw-HTML mode; our named themes cover part of the intent |

## Remaining gaps

The core page renderer covers the main official artifact patterns, but product parity is not
complete. Identity is slug-coupled, versions are opt-in, cross-process publication is not yet
transactional, local assets are not ingested, authenticated sharing is manually assembled,
hosted pages do not receive live head updates, and viewer-scoped MCP connectors plus
governance do not exist. These are explicit requirements and gates in the product spec, not
features implied by the current public-hosting adapters.
