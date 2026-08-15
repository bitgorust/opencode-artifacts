# Parity comparison: Claude Code Artifacts vs opencode-artifacts

Full capability inventory with binary evidence: [`docs/claude-code-inventory.md`](claude-code-inventory.md).

Baseline: official docs `https://code.claude.com/docs/en/artifacts` and the launch post
`https://claude.com/blog/artifacts-in-claude-code` (retrieved 2026-08-14), plus the official
viewer screenshot (`docs/references/claude-artifact-viewer.png`) and capability strings from
the Claude Code 2.1.232 binary. Version-specific additions are tracked in git history.

## Page quality

Claude's page quality comes from a built-in design skill producing raw HTML. We reach the same
visual language with a fixed renderer: card-based layout on a gray-blue canvas, metric stat
cards with delta pills, tinted insight callouts, vertical timelines, severity-coded findings,
annotated diffs, variant comparison cards, progress bars, and GitHub-style alerts. The five
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
| Strict CSP, no external requests at view time | ✅ | ✅ (`connect-src 'none'` on disk) | render test "plain markdown artifact carries CSP" |
| Size cap | ✅ 16 MiB | ✅ 15 MiB (configurable), hard error before write | render test "size cap throws" |
| Markdown **and** raw HTML authoring | ✅ | ✅ (`format: markdown \| html`) | render test "renderRawHtml" |
| Interactive charts | ✅ | ✅ vega-lite / vega / echarts, CSP-safe interpreter (`ast: true`, no `unsafe-eval`) | browser QA: both canvases mounted, 0 console errors |
| Broken-chart resilience | not documented | ✅ inline error box, page still ships | `artifact-page.png` (red box), render test |
| Title + emoji picked by the model | ✅ | ✅ + emoji as SVG favicon | `artifact-page.png` header |
| Republish updates the same URL | ✅ | ✅ stable `<slug>.html` path; `serve` adds SSE live reload (open pages refresh on republish) | QA log: marker text appeared in an already-open page with no manual refresh |
| Version history + restore | ✅ | ✅ `<slug>.vN.html` + `manifest.json` + `restore` command | `test/gallery.test.ts` |
| Gallery of all artifacts | ✅ hosted on claude.ai | ✅ local `index.html`, regenerated on every publish | `docs/evidence/gallery.png` |
| Permission prompt before publishing | ✅ | ✅ `ctx.ask({ permission: "artifact_publish", ... })` | `test/plugin.test.ts` |
| Reopen latest artifact | ✅ `Ctrl+]` | ✅ `opencode-artifacts latest --open` | CLI smoke run |
| Auto-open in browser | ✅ | ✅ `open: true` / `--open` | `src/open.ts` |
| Share links (org / public) | ✅ hosted | ❌ needs hosted backend — roadmap `HostedPublisher` | — |
| MCP connector live data at view time | ✅ | ❌ structural: requires a hosted viewer account model | — |
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

## Full capability inventory (from the 2.1.232 binary)

The public docs lag the shipped feature set. Strings extracted from Claude Code 2.1.232
(the tool registration, built-in skills, and consent machinery) reveal a second generation
of capabilities beyond the documented ones:

| Capability | Evidence in binary | Our status |
|---|---|---|
| Publish / update same URL, versions, gallery, share menu, permission prompt, emoji favicon, auto-open, live MCP connectors at view time | public docs + tool strings | ✅ at parity locally; public sharing links via GitHub Pages (v0.7); authenticated hosting via Cloudflare Worker + KV + Access (v0.8, see `docs/hosted-cloudflare.md`); viewer-identity connectors stay hosted-only |
| **artifact-design skill** (mandatory design pass before every publish) | `artifact-design` SKILL_MD | ✅ adapted into `skills/artifact-pages` |
| **Mermaid diagrams** | `artifact-diagramming` skill, mermaid composer | ✅ `mermaid` fence (v0.5), runtime inlined on use |
| **Plan artifacts** (offer to review the implementation plan as a page) | `publishPlanArtifact`, plan consent ask | ✅ publish the plan md — `examples/patterns/plan.md` (v0.5) |
| **Comments on artifacts** (threads with span quotes, resolve, auto-responder pipeline) | `CLAUDE_CODE_ARTIFACT_COMMENTS*`, comment-pipeline prompts | 🟡 local analog (v0.6): select-text → thread dock, serve-persisted, `artifact_comments` read/resolve; no identity/multi-user |
| **Workshop** (decide-and-revise loop: page carries open decisions, reader answers on the page, session reads answers back via `read_decisions`) | workshop skill, decision component | ✅ `decisions` component + serve state persistence + `artifact_state` readback (v0.5) |
| **Shared per-artifact database** (`read_db`/`write_db`, collections/docs/queries; state shared across viewers) | db action strings | 🟡 local collections DB (v0.6): `/__db` endpoints + `opencodeArtifacts.db` bridge; single-user |
| **Runtime capabilities** (`window.claude.*`: live data, shared state, file downloads, self-update; declared per page, roster-gated) | `artifact-capabilities` skill, capabilities prompt | 🟡 live-data bridge (v0.6): publish-registered datasources polled via `opencodeArtifacts.data`; no downloads/self-update |
| **watch/unwatch/status** (session gets woken when another session republishes or comments) | webhook triggers, watch actions | 🟡 viewer-side analog exists (`serve` SSE); session-side wake is structural |
| **Multi-file publish** (`files` map: separate CSS/JS/data/images) | `files` prompt paragraph | ➖ skipped by design — we inline everything into one file |
| **Stale-version guard** (refuse to publish over a version this session hasn't seen) | `stale_version_guard` errors | ✅ content-hash `expectedHash` (v0.5) |
| **Sensitive-delta guard** (block live-shared republishes that expose new sensitive content) | permission analysis strings | ✅ local version (v0.6): credential/PII regex scan blocks publish unless `force` |
| **live-edit action** | "not available in this build" | ➖ gated upstream too |

## Best path per gap

1. **Mermaid fence** — same pattern as vega: inline `mermaid.min.js` only when used, render at view time. Low effort, high value. *Next up.*
2. **Plan artifacts** — document the pattern + add an `examples/patterns/plan.md`; one line in the skill. Docs-level effort.
3. **Stale-version guard** — store a content hash in `manifest.json` per publish; `artifact_publish` compares and warns/refuses when overwriting unseen content. Small, self-contained.
4. **Workshop + comments + shared DB** — all three reduce to one mechanism: the `serve` process gains a per-artifact JSON store (write via POST, read via a declared bridge script injected into served pages) and the plugin gains read-back actions. Local single-user versions of comments/DB are of limited value, but the **workshop decide-and-revise loop is genuinely useful locally** (reader answers on the page, session reads decisions back) — build that one first.
5. **Runtime capabilities / live data** — a declared bridge (`window.opencodeArtifacts.*`) injected by `serve`, proxying allow-listed reads (e.g. MCP tool calls). Medium-high effort; only worth it after workshop proves the bridge pattern.
6. **Org sharing, multi-viewer state, comment identity, audit** — structural: require `HostedPublisher` + accounts. Not locally replicable.
7. **Sensitive-delta guard** — an OpenCode permission hook that diffs republished content against the previous version and escalates on new secrets/PII patterns; regex-level first, LLM-review optional.

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

Same-task quality verdict:

| Task class | Same quality as Claude? |
|---|---|
| Dashboards, reports, incidents, timelines, checklists, comparisons, data tables | Yes — with better consistency (fixed renderer floor), see `docs/evidence/patterns/` |
| Explainers with bespoke SVG diagrams | Partially — mermaid yes; hand-tuned SVG needs `format: "html"` |
| Interactive playgrounds (canvas sims, 3D, pyodide tools, single-purpose editors) | Only via raw-HTML mode; quality then tracks the model, same as theirs |
| Editorial bespoke pages (claudeatplay class) | Only via raw-HTML mode; our named themes cover part of the intent |

## Remaining gaps (structural, not quality)
Org/public **sharing links** and **view-time MCP connectors** require hosted infrastructure
(accounts, org auth, retention, compliance). The `Publisher` interface already isolates that
work behind `HostedPublisher`; everything user-visible on a single machine is at parity.
