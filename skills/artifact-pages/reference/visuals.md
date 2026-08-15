# Visuals reference — diagrams and charts

Distilled from Claude Code 2.1.232's `artifact-diagramming` and `dataviz` skills, adapted to
our fence model. Load this when a page includes any diagram or chart.

## Diagrams (`mermaid` fence)

- **A diagram earns its place** when it lets a cold reader see a mechanism they would
  otherwise assemble from prose — where data flows, which components talk, what changes
  between two options, what state a request moves through. If a sentence says it faster,
  write the sentence.
- **Depict the mechanism, not its name.** A box labeled "cache" says less than prose; the
  path a request takes through it, the two stores it sits between, the arrow that disappears
  when it's removed — that's what words can't show.
- **Comparing options? Draw the difference** — the one edge each option adds or removes.
  Two unconnected labeled boxes are a restated option list, not a comparison.
- **Label the arrows.** An unlabeled arrow says "related somehow"; `writes`, `invalidates`,
  `polls every 30s` is information.
- **Match complexity to the stakes** — a one-hop question is a three-box diagram; no forced
  minimalism, no whole-system inventory either.
- **One figure, one claim** — the caption or heading states what the picture shows.

## Charts (`vega-lite` / `vega` / `echarts` fences)

**Choose the form the data's shape calls for:**
- Trend over time → line/area (never invent a time axis for data that has none)
- Category comparison → bar
- Part-of-whole → donut only with ≤ 5 slices; otherwise bar
- Distribution → histogram; relationship → scatter

**Never:** 3D, dual axes, radar charts for precision, truncated axes without disclosure
(say so in the title or footer), pie charts past five slices.

**Color:** semantic tones (`good`/`bad`/`warn`) are reserved for meaning — a falling error
rate is `good`. The accent hue marks the series under discussion; everything else goes gray.
Color deltas by whether the news is good, not by direction.

**Titles state the finding, not the axes** — "Completion snapped at v4.2", not "Completion
rate by day".

**Interaction only when it answers a question** — tooltips and zoom on dense series;
none by default (every interaction costs tokens and attention).
