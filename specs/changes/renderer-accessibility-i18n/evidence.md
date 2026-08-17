# Evidence: Complete renderer accessibility and internationalization

## Requirement: RENDER-06
- Validation: Phase 2 requires WCAG, keyboard, zoom, motion, Unicode, locale, and RTL correctness.
- Verification: planned semantic/automated checks plus real desktop/mobile-width keyboard and assistive-technology matrix.
- Result: semantic/unit checks and Chromium desktop/mobile/200%-equivalent RTL runs passed with
  empty audits, no horizontal overflow, no console errors, and no external requests. Manual
  screen-reader access is unavailable, so the certification cell remains open.
- Evidence: `test/accessibility.test.ts`; `test/serve.test.ts`;
  `docs/evidence/renderer/goal-3-accessibility-2026-08-17.md`; [@manual](docs/roadmap.md)

## Requirement: QUAL-04
- Validation: user-visible accessibility cannot be certified from source assertions alone.
- Verification: planned retained browser versions, console results, screenshots, keyboard traces, and manual outcomes.
- Result: Chromium 151 retained keyboard traces, accessibility-tree roles/names, light/dark,
  reduced-motion, 390-pixel, 640-CSS-pixel-at-2x, print, console, request, and screenshots.
  Manual screen-reader result is explicitly unavailable rather than inferred.
- Evidence: `docs/evidence/renderer/goal-3-accessibility-{desktop,mobile-reduced,zoom-200}-2026-08-17.{json,png}`;
  [@manual](docs/goal-runbook.md)
