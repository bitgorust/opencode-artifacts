# Component Authoring Spec (v0.3)

Goal: reach Claude Code Artifacts **page** quality while keeping our authoring model
(model writes Markdown + JSON specs, fixed renderer owns the HTML/CSS).

Reference: `docs/references/claude-artifact-viewer.png` (official viewer screenshot),
`docs/claude-code-comparison.md` (pattern list from official docs).

## Design tokens (extracted from the official screenshot)

```
--page-bg:        #e9edf2  (light gray-blue)
--card-bg:        #ffffff
--card-radius:    16px
--card-padding:   24px
--card-shadow:    0 1px 3px rgb(15 23 42 / 0.06)
--ink:            #111827
--ink-2:          #4b5563
--ink-3:          #9ca3af
--line:           #e5e7eb
--accent:         #6d6bd6  (periwinkle, chart fill / pills)
--good:           #2f9e6e  on #e4f4ec
--bad:            #d64550  on #fdeeee
--warn:           #b45309  on #fdf0dc
--info:           #33526e  on #dce6f2
--card-bad-bg:    #fdeeee  (whole metric card tinted when tone=bad)
--card-info-bg:   #e3eaf4  (insight card, blue-gray)
--card-warn-bg:   #fdeccd  (insight card, amber)
--radius-pill:    999px
--font:           system-ui stack
--font-mono:      ui-monospace stack
```

Dark mode: same hues, backgrounds shifted (page `#151a21`, card `#1f2630`, ink `#e5e7eb`),
via `color-scheme: light dark` + `@media (prefers-color-scheme: dark)` overrides.

## Page layout

- Page background `--page-bg`; content column max-width 1080px.
- Top-level `## h2` sections become **white cards** (split rendered body HTML on `<h2`,
  wrap each chunk in `<section class="card">`; intro content before the first h2 stays unwrapped).
- h2 = narrative headline style: 22px/700, tight letter-spacing.
- Every heading gets an `id` anchor (slugified text) — pages are single-file, in-page anchors only.

## Components (new fenced block types, JSON payload)

### ```stats — metric cards row (the hero component in the screenshot)
```json
[
  { "label": "EDITOR SESSIONS", "value": "8.41M", "delta": "3.1%", "direction": "up", "tone": "good" },
  { "label": "EXPORT COMPLETION", "value": "27.8%", "delta": "9.4pt", "direction": "down", "tone": "bad", "emphasis": true }
]
```
Renders: grid of cards; big bold value, small-caps gray label, delta pill (▲/▼) in
tone color; `tone: "bad"` tints the whole card `--card-bad-bg`. Fields `delta/direction/tone/emphasis` optional.

### ```timeline — vertical incident timeline
```json
[{ "time": "13:54", "title": "Alert fires", "detail": "p99 > 2.5s for 5m", "tone": "bad" }]
```
Renders: left rail with dots, time in mono, title bold, detail gray; tone colors the dot.

### ```findings — severity-coded findings (PR walkthrough / security review)
```json
[{ "severity": "high", "title": "Sync fraud check on hot path", "location": "src/payments/checkout.ts:88", "detail": "..." }]
```
Renders: rows with severity pill (critical `#7f1d1d/#fee2e2`, high bad, medium warn, low info),
location in mono.

### ```compare — variant cards side by side
```json
[{ "title": "4.2 — Current", "pill": "red", "annotations": ["Pro preselected", "CTA sells the plan"], "tradeoff": "Higher intent, darker pattern" }]
```
Renders: equal-width cards; pill tag, numbered annotations (❶❷), one-line tradeoff in italic gray.
`body` optional for a mock/description block (raw markdown text, rendered inline).

### ```callout — insight card (colored, like "The funnel didn't sag" / "Cancels are reflexes")
```json
{ "tone": "info", "title": "The funnel didn't sag — it snapped", "body": "..." }
```
tones: info (blue-gray), warn (amber), good, bad. Bold narrative title + body.

### ```progress — checklist progress bar
```json
{ "label": "Migration", "done": 7, "total": 12 }
```

### ```diff — annotated diff
Plain unified diff text; lines starting with `## note:` become annotation rows (gray, italic,
spanning). `+` green bg, `-` red bg, `@@` hunk headers muted.

### ```copy — copy-to-clipboard button (added v0.4)
```json
{ "label": "Copy as prompt", "text": "multi-line text, preserved" }
```
Text rides in an inert `<template>` element (escaping-safe, newline-preserving); the fixed boot
script writes it to the clipboard on click and shows a transient confirmation.

### Interactive controls (added v0.4)
No custom component needed: vega-lite `params` with `bind` render as native sliders/selects and
re-render the chart live through vega's signal graph (CSP-safe under `ast: true`); echarts
`dataZoom` / toolbox options work as-is. Anything beyond chart-bound controls → raw HTML mode.

### ```mermaid — diagrams (added v0.5)
Raw mermaid source (not JSON) in the fence; rendered client-side by the inlined mermaid runtime
(only when used), themed via `prefers-color-scheme`. Render failures degrade to the error box.

### ```decisions — workshop decision rows (added v0.5)
```json
{ "title": "Open decisions", "questions": [{ "id": "layout", "question": "...", "options": [{ "id": "tabs", "label": "...", "note": "..." }] }] }
```
Clicking an option marks it selected, persists to localStorage, and — when the page is served
by `opencode-artifacts serve` — POSTs the full answers map to `/__state/<slug>` (stored at
`.state/<slug>.json`). The session reads answers back via the `artifact_state` plugin tool or
`opencode-artifacts state <slug>`. This is the local analog of Claude Code's workshop
`read_decisions` loop.

### Stale-version guard (added v0.5)
Every publish records a 12-char content hash in the manifest and returns it. Callers pass it
back as `expectedHash`; a mismatch throws `StaleArtifactError` and nothing is written. The
plugin wraps refusals with the current page content (head + body, 16 KB cap) so the session
can merge edits and republish without a separate read — the autoread-recovery pattern from
Claude Code's stale guard.

### Themes (added v0.11)
Frontmatter `theme:` selects a curated variant appended after the base stylesheet so it wins
in both color modes: `default` (gray-blue canvas, white cards), `report` (warm paper, serif
display headings, terracotta accent), `ops` (dark-first, terminal green, mono headings),
`editorial` (white, large serif display type, hairline borders, square corners). Unknown
values fall back to `default`. Themes are deliberately single-look (like Claude Code's
"commits to one visual world" allowance) rather than dual-theme.

Evidence: `docs/evidence/patterns/funnel-{report,ops,editorial}.png` — one source, three
identities, browser-verified.

Default (unnamed) pages follow the three-state theme model from Claude Code's artifact-design
skill: bare `:root` is the full light palette, the dark media query is guarded by
`:root:not([data-theme="light"])`, and `:root[data-theme="dark"]` wins for explicit dark. A
header toggle cycles system → dark → light and persists to localStorage
(`docs/evidence/theme-toggle-dark.png`). Named themes are single-look and hide the toggle.

## Markdown-level additions

- GitHub alerts: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]`
  → styled callout boxes (post-process rendered `<blockquote>` HTML).
- Task lists: `- [ ]` / `- [x]` render as styled checkboxes (read-only).
- Invalid JSON in any component fence → inline error box (existing behavior, reused).

## Mapping to the documented Claude patterns

| Claude pattern (docs) | Our components |
|---|---|
| Walk through a change (annotated diff, severity) | `diff`, `findings` |
| Compare alternatives (variants + tradeoff) | `compare` |
| Track work in progress (checklist) | task lists + `progress` |
| Dashboard | `stats`, charts, `callout` |
| Incident page / postmortem | `timeline`, `stats`, charts, `callout` |
| Findings linked to lines | `findings` (`location`) |
| Tune with interactive controls | vega-lite `params.bind` sliders, echarts `dataZoom` (verified live in browser QA) |
| Bring the result back to the session | `copy` button (verified: click writes to clipboard, shows confirmation) |
| Free-form interactivity (drag-drop boards etc.) | raw HTML mode (`format: "html"`) |

## Acceptance

- Each component renders from JSON, escapes text, and has a node:test case.
- Five example pages under `examples/patterns/`: dashboard, incident, pr-walkthrough,
  release-checklist, compare-layouts — each passing browser QA (screenshot).
