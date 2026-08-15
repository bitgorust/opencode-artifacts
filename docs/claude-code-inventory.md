# Claude Code Artifacts — full inventory (from binary 2.1.232 + docs)

Distilled from: the official docs (`code.claude.com/docs/en/artifacts`), the launch post,
and string extraction from the Claude Code 2.1.232 binary (skill registry, tool
registration, consent machinery). Purpose: the reference inventory for our parity work.

## Skill fleet

| Skill | Role | Load discipline |
|---|---|---|
| `artifact-design` | design fundamentals, anti-cliché list, naming rules | mandatory before writing any artifact |
| `artifact-capabilities` | `window.claude.*` runtime roster | gate: must load before declaring capabilities |
| `artifact-diagramming` | diagram craft, inline SVG, mermaid | when drawing |
| `artifact-pr-review` | PR review pages | when reviewing |
| `artifact-pr-review` | PR review pages | when reviewing |
| `workshop` | decide-and-revise loop pages | when workshopping |
| `artifact-dashboard` | KPI tiles + primary chart + breakdown table, slot template | dashboards |
| `artifact-data-table` | sortable/filterable table, slot template | tabular datasets |
| `artifact-explainer` | step-by-step teaching pages, slot template | explainers/tutorials |
| `artifact-components` | embeddable reusable components with hash-pinned scripts | when a page carries decisions |
| `plan-artifact` | publish the implementation plan as a page | plan review |
| adjacent: `dataviz`, `whiteboard`/`canvas`, `prototype` | chart honesty method (with a runnable palette validator), canvas board, app prototype | referenced from artifact-design |

The template skills share a discipline worth copying: slot markers that must ALL be replaced,
"never invent a value", provenance footers, and number-formatting rules — all now in our
`docs/component-spec.md` and skill reference.

## Absorption status (vs our artifact-pages skill)

Fully absorbed: artifact-design, artifact-dashboard, artifact-data-table, artifact-explainer,
artifact-pr-review (structure), workshop, plan-artifact, artifact-components (philosophy).
Not applicable: artifact-capabilities (no `window.claude.*` runtime).

Absorbed in `skills/artifact-pages/reference/visuals.md`: artifact-diagramming (mechanism-over-name, labeled arrows, one-figure-one-claim) and dataviz (form heuristic, color-by-meaning,
anti-pattern list, interaction discipline). Their runnable palette validator stays unported —
our palettes are fixed token sets, so there is nothing to validate.

Plus: plan-artifact flow (offer to review a plan as a page) and a reusable-component skill
(first entry: the workshop decision component).

## Tool surface

One `Artifact` tool, ~12 actions: publish, live-edit (gated), list, read, watch, unwatch,
status, comments, resolve, read_page_data, read_decisions, read_db, write_db.

## Feature families

- Publishing: same-URL redeploy by file path, versions, restore, share menu with version
  picker, gallery, description subtitle, emoji favicon, title scan (first 8KB), auto-open,
  Ctrl+] reopen
- Collaboration: comments (span-quoted threads, resolve, analyst subagent pipeline),
  editor role (Team/Enterprise), shared per-artifact database
- Runtime: capabilities (live data / shared state / downloads / self-update), MCP
  connectors called as the *viewer's* account at view time
- Guards: publish permission prompt, fail-closed consent floors, stale-version guard with
  autoread recovery, sensitive-delta analysis for live-shared republishes
- Admin: org toggle, RBAC scoping, retention policies, compliance API, public-sharing
  toggle, connector toggle

## Patterns we adopt vs. deliberately invert

Adopt: chart honesty ("title the finding, not the axes"), fail-closed consent, layered
guards, naming-like-a-product, copy-as-design-material, token-cost discipline (SVG over
raster, drop unneeded interactivity, summarize datasets).

Invert (with justification): fixed renderer + Markdown/JSON authoring instead of
hand-written per-page HTML (consistency, diffability, safety, token cost); single-file
inline instead of multi-file publish; Markdown as the *preferred* format (their warning
assumed Markdown = no craft; our renderer supplies the craft).

See `docs/claude-code-comparison.md` for the parity matrix and evidence.
