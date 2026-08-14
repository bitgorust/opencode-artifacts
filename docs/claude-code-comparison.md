# Parity comparison: Claude Code Artifacts vs opencode-artifacts

Baseline: official docs `https://code.claude.com/docs/en/artifacts` and the launch post
`https://claude.com/blog/artifacts-in-claude-code` (retrieved 2026-08-14).
Compared against opencode-artifacts v0.2.0.

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

## Remaining gaps (structural, not quality)

Org/public **sharing links** and **view-time MCP connectors** require hosted infrastructure
(accounts, org auth, retention, compliance). The `Publisher` interface already isolates that
work behind `HostedPublisher`; everything user-visible on a single machine is at parity.
