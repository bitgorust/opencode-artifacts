# Goal 5 refrozen-candidate local composition evidence

Status: **pass for the renderer-only local browser track; comparative and certification claims remain unverified**

Captured: 2026-08-19

Candidate SHA-256: `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd`

## Scope and result

The eight checked-in `page-quality-v1` fixtures were rendered after the installed-CLI defect
was corrected and the candidate was refrozen. Each ran at 1440 × 900 in light mode and
390 × 844 in dark/reduced-motion mode through Chromium 151.0.7922.108.

- 16 of 16 cells passed;
- maximum useful-content time: 1,596 ms;
- maximum layout shift: 0.03243 against the 0.1 threshold;
- minimum primary-visual utilization: 0.907;
- minimum chart fill: 1.0; and
- no overflow, clipped text, render error, severe browser log, or external HTTP request.

Keyboard traces cover the skip-link path and the applicable table, decision, range, and copy
interactions. The 16 hash-bound machine reports and aggregate are retained under
[`2026-08-19-local-composition/`](2026-08-19-local-composition/). Prior visual screenshots
remain representative because the refreeze changed CLI entrypoint detection, not rendered
HTML/CSS/JS; this rerun does not substitute for the missing manual screen-reader check.

The deterministic report gate passes with:

```sh
npm run quality:local -- docs/evidence/page-quality/2026-08-19-local-composition \
  docs/evidence/page-quality/2026-08-19-local-composition/summary.json
```

No current Claude output or independent reviewer score was generated. This evidence cannot
support an equal-or-better, supported-platform, representative-user, or certification claim.
