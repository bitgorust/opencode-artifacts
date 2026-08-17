# Goal 3 bounded design-token evidence — 2026-08-17

## Scope

This observation covers the checked-in `examples/patterns/design-tokens.md` fixture rendered
by the CLI and opened directly from `file://` in Chromium 151 with offline network emulation.
It verifies the real desktop and narrow-viewport surface for the approved
`renderer-design-tokens` packet; it is not a browser/OS support claim.

## Reproduction

1. Render the fixture with Node 24 using `opencode-artifacts render`.
2. Open the resulting portable HTML in `selenium/standalone-chromium` with CDP network
   emulation set offline.
3. Capture computed token variables, provenance metadata, CSP, page overflow, browser console,
   attempted requests, and screenshots at requested 1440×1600 and 390×1000 windows.

The reusable capture script is `scripts/portable-browser-evidence.ts`. Chrome window chrome
left inner viewports of 1440×1457 and 390×857 respectively.

## Result

- Both surfaces computed the authored values: `#f5f1ff` page background, `#ffffff` surface,
  `#211735` text, `#6d28d9` accent, `8px` radius, and the allowlisted serif stack.
- Both exposed `data-design-tokens`, the complete prompt provenance record, the named `report`
  lower-precedence theme, and the unchanged strict on-disk CSP.
- Both reached `readyState=complete`, rendered one table, had no horizontal page overflow,
  produced zero browser-console entries, and attempted zero HTTP(S) requests offline.
- The screenshots retain readable desktop composition and narrow single-column recomposition.

Evidence files:

- [desktop observation](goal-3-design-tokens-desktop-2026-08-17.json)
- [desktop screenshot](goal-3-design-tokens-desktop-2026-08-17.png)
- [mobile observation](goal-3-design-tokens-mobile-2026-08-17.json)
- [mobile screenshot](goal-3-design-tokens-mobile-2026-08-17.png)

## Boundary

This is one Linux-container Chromium observation. Native macOS/Windows, additional browsers,
assistive technology, print/PDF, localization, and performance claims remain governed by the
later Goal 3 accessibility and performance packets and the declared support matrix.
