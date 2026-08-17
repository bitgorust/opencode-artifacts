# Authoring reference — artifact pages

The `artifact_publish` tool takes `markdown`. Frontmatter (`---` fences) sets `title:`,
`icon:` (emoji favicon), and `description:` (gallery subtitle). `##` sections become white
cards on the page. Republish with the same title to update in place; `version: true` keeps
numbered history; `open: true` opens the browser; `expectedHash` guards against overwriting
unseen changes; `force: true` overrides the credential scan.

## Component fences (JSON payloads)

| Fence | Schema | Use for |
|---|---|---|
| ```` ```stats ```` | `[{label, value, delta?, direction?: up\|down, tone?: good\|bad\|warn\|neutral, emphasis?}]` | metric card rows |
| ```` ```timeline ```` | `[{time, title, detail?, tone?}]` | incident/phase timelines |
| ```` ```findings ```` | `[{severity: critical\|high\|medium\|low, title, location?, detail?}]` | review/security findings |
| ```` ```compare ```` | `[{title, pill?, annotations?: string[], tradeoff?}]` | variant cards side by side |
| ```` ```callout ```` | `{tone: info\|warn\|good\|bad\|neutral, title?, body?}` | tinted narrative insight cards |
| ```` ```progress ```` | `{label?, done, total}` | progress bars |
| ```` ```diff ```` | unified diff text; lines starting `## note:` become annotation rows | annotated diffs |
| ```` ```copy ```` | `{label?, text}` | copy-to-clipboard button (for handing text back to the session) |
| ```` ```mermaid ```` | raw mermaid source (not JSON) | diagrams: graph/sequence/ER/... |
| ```` ```decisions ```` | `{title?, questions: [{id, question, options: [{id, label, note?}]}]}` | workshop rows; answers read back via `artifact_state` |
| ```` ```table ```` | `{caption?, columns: [{key, label, type?: num}], rows: [{...}]}` | sortable, filterable data tables |

## Data honesty (non-negotiable)

- Numbers format for scanning: unit + 2–3 significant figures, thousands separators.
- Color deltas by meaning, not direction — a falling error rate is `good`, not `bad`.
- Truncated axes are disclosed in the chart title or footer.
- Breakdown tables keep ~top ten rows plus "Other".
- Never invent values or a time axis that doesn't exist; drop the section instead.
- Every data page sets frontmatter `source:` (system + capture date) — it lands in the footer.

## Structures that work

- **Explainer**: lede stating what the reader learns → numbered steps pairing short prose
  with a visual (diagram or code) → recap. For PR walkthroughs/system tours, use sections
  instead of steps, open with one wide architecture diagram when there's a structural story.
- **PR briefing**: synthesis title with the bottom line → recommendation → judgment calls
  (`decisions` or `findings`) → signals → blind spots. Readable in two minutes without
  opening the diff.

## Charts

```` ```vega-lite ```` / ```` ```vega ```` / ```` ```echarts ```` fences take one JSON spec.
Vega-Lite compiles at render time and runs in the CSP-safe interpreter. Interactivity needs
no custom JS: vega-lite `params` with `bind` render as sliders/dropdowns; echarts `dataZoom`
gives pan/zoom. Title the finding, not the axes.

## Markdown extras

GitHub alerts — `> [!NOTE]` `[!TIP]` `[!IMPORTANT]` `[!WARNING]` `[!CAUTION]` — become toned
callout boxes. `- [ ]` / `- [x]` become styled checkboxes. Headings get id anchors. Raw HTML
is never passed through. CLI/plugin publication reports broken component specs together and
refuses before permission or writes; standalone rendering retains escaped inline error boxes
for inspection.

## Themes (optional)

Frontmatter `theme:` selects a curated variant: `default` (gray-blue canvas, white cards),
`report` (warm paper, serif headings), `ops` (dark-first terminal), `editorial` (magazine
display type). Anything else falls back to `default`.

## Bounded design tokens (optional)

Project defaults live only at `.opencode/artifact-tokens.json`; a page-level prompt override
uses one `design-tokens` fence. Both use the same atomic versioned form:

```json
{"schemaVersion":1,"tokens":{"accent":"#6d28d9","font":"serif","spacing":"spacious","radius":"soft","density":"airy"}}
```

Allowed token names are `pageBackground`, `surface`, `text`, `mutedText`, `border`, `accent`,
`font`, `spacing`, `radius`, and `density`. Colors are six-digit hex; font is
`system|serif|mono`; spacing is `compact|comfortable|spacious`; radius is
`square|sharp|soft|round`; density is `compact|comfortable|airy`. Prompt > project > curated theme >
built-in defaults. Unknown/unsafe/low-contrast values reject the whole source before publish;
raw CSS, selectors, URLs, markup, imports, expressions, and remote fonts are never accepted.
