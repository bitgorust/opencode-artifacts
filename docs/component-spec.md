# Component Authoring Spec

Goal: reach Claude Code Artifacts **page** quality while keeping our authoring model
(model writes Markdown + JSON specs, fixed renderer owns the HTML/CSS).

Reference: the official [Claude Code Artifact guide](https://code.claude.com/docs/en/artifacts),
`docs/claude-code-comparison.md` (pattern list from official docs), and
`docs/page-quality-benchmark.md` (comparative quality gate). Official media remains link-only
unless explicit redistribution authority is recorded.

## Built-in design tokens (adapted from the official visual reference)

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
--accent:         #5f5dbf  (AA periwinkle, chart fill / pills)
--good:           #237a52  on #e4f4ec
--bad:            #b42335  on #fdeeee
--warn:           #92400e  on #fdf0dc
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

### Accessibility and internationalization

Declarative pages expose a skip link, header/main landmarks, Unicode-safe heading anchors,
visible focus, control names/state, reduced-motion behavior, responsive reflow, and a print
mode that removes interactive chrome. Frontmatter accepts `lang`, `dir`, `locale`, and
`timezone`; the deterministic fallback is English (`en-US`), left-to-right, and UTC. RTL
languages infer RTL direction unless `dir` is explicit.

Every chart requires a top-level `description`, every Mermaid fence begins with
`%% summary: ...`, and every table requires `caption`. Tables accept `num`, `date`, and
`datetime`; date values are zoned ISO timestamps and render under the declared locale and IANA
time zone. Missing equivalents or invalid locale metadata refuse CLI/plugin publication.
Decisions use radio semantics and arrow-key navigation. Served comments expose a named
launcher and dialog with Escape/cancel/save focus restoration.

### Bounded project and prompt overrides

The renderer discovers only `.opencode/artifact-tokens.json` for project tokens. A document
may contain one `design-tokens` JSON fence for explicit prompt-level values. Both use
`{"schemaVersion":1,"tokens":{...}}`; the shipped authoring reference owns the exact key and
enum list. Precedence is prompt > project > curated theme > built-in defaults.

Each source is capped at 8 KiB, parsed atomically, contrast checked against its effective lower
layers, and emitted in deterministic order through fixed CSS-variable slots. Unknown keys,
non-hex colors, arbitrary font strings, selectors, declarations, URLs, markup, imports, and
expressions refuse publication before permission or writes. The portable page retains named
per-token provenance. Trusted HTML does not participate in this bounded token path.

## Page layout

- Page background `--page-bg`; content column max-width 1080px.
- Top-level `## h2` sections become **white cards** (split rendered body HTML on `<h2`,
  wrap each chunk in `<section class="card">`; intro content before the first h2 stays unwrapped).
- h2 = narrative headline style: 22px/700, tight letter-spacing.
- Every heading gets an `id` anchor (slugified text) — pages are single-file, in-page anchors only.
- Primary charts, diagrams, diffs, and mockups size from their container instead of keeping a
  small fixed canvas inside a wide card. A deliberately compact visual must have adjacent
  narrative or comparison content that explains the remaining space.
- Desktop compositions may use full-width, split, asymmetric, or dense dashboard layouts;
  narrow viewports recompose into a readable sequence without clipped labels or horizontal
  page scrolling.
- Card treatment follows information hierarchy. The renderer supplies emphasis and
  composition variants so every section is not forced into an identical white rectangle.

## Components

Component JSON schemas have exactly one home: `skills/artifact-pages/reference/components.md`
(it ships in the npm package and is what agents read). This document keeps the design
rationale; never copy schema tables into it.

Available fences: `stats`, `timeline`, `findings`, `compare`, `callout`, `progress`, `diff`,
`copy`, `mermaid`, `decisions`, `table`, `frame`; chart fences `vega-lite` / `vega` / `echarts`;
interactive controls via vega-lite `params.bind` and echarts `dataZoom` (verified live in
browser QA); free-form interactivity stays in raw-HTML mode (`format: "html"`).

Frontmatter `composition:` selects one bounded layout grammar: `standard`, `narrative`,
`dashboard`, `split`, `dense`, `quiet`, or `full`. These modes change visual scale, section
grouping, and density while retaining source/DOM order. Invalid values refuse publication.
At narrow widths every multi-column mode becomes the same logical single-column sequence.

### Data honesty rules (from Claude Code's dashboard/dataviz skills)

- Format numbers for scanning: unit + 2–3 significant figures, thousands separators; at most
  one decimal on percentages.
- Color deltas by meaning, not direction — when a decrease is the improvement (latency, cost,
  error rate), the tone must say whether the news is good.
- Narrow ranges far from zero need an explicit y-domain — and the truncated axis must be
  disclosed in the chart title or footer.
- Breakdown tables: roughly top ten rows, roll the tail into "Other".
- Never invent values, dates, or a time axis for data that has none; a section without real
  data is removed, not filled.

### Provenance

Frontmatter `source:` lands in the page footer as `Data: <source>` — every data page names
where its numbers came from and when they were captured.

### Stale-version guard
Every publish records a 12-char content hash in the manifest and returns it. Callers pass it
back as `expectedHash`; a mismatch throws `StaleArtifactError` and nothing is written. The
plugin wraps refusals with the current page content (head + body, 16 KB cap) so the session
can merge edits and republish without a separate read — the autoread-recovery pattern from
Claude Code's stale guard.

### Themes
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
- CLI/plugin publication aggregates invalid component JSON with other authoring diagnostics
  and refuses before permission or writes. Standalone rendering retains the escaped inline
  error box fallback.

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
- Every example page under `examples/patterns/` passes browser QA with a screenshot archived
  in `docs/evidence/patterns/`.
- The core declarative corpus passes the hard gates and blinded equal-or-better threshold in
  [`docs/page-quality-benchmark.md`](page-quality-benchmark.md). Pattern coverage and golden
  screenshots alone do not establish parity with Claude Code Artifacts.
