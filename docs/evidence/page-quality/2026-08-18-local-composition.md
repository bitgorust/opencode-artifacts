# Goal 5 local composition evidence

Status: **pass for the renderer-only local browser track; comparative and certification claims remain unverified**

Captured: 2026-08-18

Candidate: `agent/goal-5-local-core` working tree after Goal 5 packet approval

## Scope

This report covers the eight checked-in `page-quality-v1` fixtures rendered through the
ordinary Markdown/component pipeline. It is local regression evidence for the renderer track
defined in `docs/page-quality-benchmark.md`; it is not a Claude comparison, a supported-platform
matrix, a representative-user study, or Local artifact core certification.

The retained set contains each fixture at 1440 × 900 in light mode and 390 × 844 in dark mode
with reduced motion. Chromium was supplied by `selenium/standalone-chromium` version 151.
Screenshots and machine-readable observations are under
[`2026-08-18-local-composition/`](2026-08-18-local-composition/), with the hash-bound aggregate
in [`summary.json`](2026-08-18-local-composition/summary.json).

## Result

- 16 of 16 required cells passed.
- Maximum useful-content time was 971 ms.
- Maximum observed layout shift was 0.03243 against the 0.1 local threshold.
- Minimum primary-visual utilization was 0.907; minimum chart fill was 1.0.
- No cell reported document/main horizontal overflow, clipped text, renderer errors, severe
  browser logs, or external HTTP requests.
- Keyboard traces retained the skip-link path, sortable table state, decision/range behavior,
  and copy behavior where applicable.
- The system-explainer Mermaid SVG and dashboard Vega-Lite chart were measured after settled
  rendering; both recompose at the narrow viewport without clipping or accidental dead space.

The deterministic gate is rerunnable with:

```sh
npm run quality:corpus
npm run quality:local -- docs/evidence/page-quality/2026-08-18-local-composition \
  docs/evidence/page-quality/2026-08-18-local-composition/summary.json
node --test test/page-quality-corpus.test.ts test/page-quality-local-report.test.ts
```

## Evidence boundary and open gates

No current Claude Artifact outputs were generated, no Claude account or retention authority was
assumed, and no independent reviewer scores were collected. Therefore the equal-or-better claim
remains unverified. Manual screen-reader review of these new composition changes, supported
Firefox/Safari/OS cells, the consented first-use/comprehension study, and exact-candidate release
evidence also remain pending. This report cannot be reused to mark those gates passed.
