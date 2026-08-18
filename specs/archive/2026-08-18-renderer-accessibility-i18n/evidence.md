# Evidence: Complete renderer accessibility and internationalization

## Requirement: RENDER-06
- Validation: Phase 2 requires WCAG, keyboard, zoom, motion, Unicode, locale, and RTL correctness.
- Verification: planned semantic/automated checks plus real desktop/mobile-width keyboard and assistive-technology matrix.
- Result: semantic/unit checks and Chromium desktop/mobile/200%-equivalent RTL runs passed with
  empty audits, no horizontal overflow, no console errors, and no external requests. On
  2026-08-18, Aaron Zeng (`aaron.zeng`) reported the manual checklist passed on Fedora 44 with
  Orca 50.2 and Chrome 151.0.7922.137.
- Evidence: `test/accessibility.test.ts`; `test/serve.test.ts`;
  `docs/evidence/renderer/goal-3-accessibility-2026-08-17.md`; [@manual](docs/roadmap.md)

## Requirement: QUAL-04
- Validation: user-visible accessibility cannot be certified from source assertions alone.
- Verification: planned retained browser versions, console results, screenshots, keyboard traces, and manual outcomes.
- Result: Chromium 151 retained keyboard traces, accessibility-tree roles/names, light/dark,
  reduced-motion, 390-pixel, 640-CSS-pixel-at-2x, print, console, request, and screenshots.
  The named Fedora/Orca/Chrome user attestation supplies the previously open manual
  screen-reader result without extending the supported-platform matrix.
- Evidence: `docs/evidence/renderer/goal-3-accessibility-{desktop,mobile-reduced,zoom-200}-2026-08-17.{json,png}`;
  `docs/evidence/renderer/goal-3-accessibility-2026-08-17.md`; [@manual](docs/goal-runbook.md)
