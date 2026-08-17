# Goal 3 accessibility and internationalization evidence — 2026-08-17

Scope: implementation evidence for `renderer-accessibility-i18n`. It is a Linux/Chromium
observation, not screen-reader or supported-platform certification.

## Automated coverage

The checked-in `examples/patterns/accessibility-rtl.md` fixture declares Arabic, RTL,
`ar-EG`, and `Asia/Riyadh`, and includes an alert, tasks, progress, ECharts summary, captioned
numeric/zoned-date table, decisions, and served comments. `test/accessibility.test.ts` checks
the semantic output, deterministic locale/time-zone formatting, preflight refusals, logical
CSS, responsive/print/reduced-motion rules, and AA contrast pairs. `test/serve.test.ts`
retains the bridge-before-boot regression that makes persisted state and the comment launcher
available when the renderer initializes.

## Real Chromium surface

Harness: `scripts/accessibility-browser-evidence.ts` with Chromium 151 from
`selenium/standalone-chromium`. It retains Chrome's accessibility tree, keyboard state
transitions, computed media/color/layout observations, print observations, browser console,
requests, and screenshots.

| Cell | CSS viewport | Media | Result |
|---|---:|---|---|
| desktop | 1440 × 1057 | light preference, motion allowed | pass |
| mobile-width | 390 × 701 | dark preference, reduced motion | pass |
| 200%-equivalent reflow | 640 × 500 at DPR 2 from a 1280 × 1000 physical surface | light preference | pass |

The 200% cell uses Chromium device metrics: half the CSS viewport at two physical pixels per
CSS pixel. This deterministically exercises the same reflow width without claiming that the
headless browser's UI zoom shortcut changed state.

Across all three cells:

- the semantic audit was empty, the accessibility tree named the Arabic chart summary and
  captioned table, horizontal page overflow was false, browser console entries were zero,
  and external HTTP requests were zero;
- Tab focused the skip link and Enter moved focus to `artifact-main`; ArrowRight moved the
  decision radio and updated `aria-checked`; Enter sorted the table and updated
  `aria-sort="ascending"`;
- Enter on the comment launcher focused the named textarea, Escape restored launcher focus,
  and keyboard save created one comment and restored focus without leaving a dialog open;
- the theme control switched state by keyboard with visible focus; the mobile cell reported
  dark preference and reduced motion; and the 200%-equivalent RTL cell retained all content
  without horizontal overflow or dock obstruction;
- print emulation hid theme/comment/filter controls and used a white page background.

Retained artifacts:

- `goal-3-accessibility-desktop-2026-08-17.{json,png}`
- `goal-3-accessibility-mobile-reduced-2026-08-17.{json,png}`
- `goal-3-accessibility-zoom-200-2026-08-17.{json,png}`

## Open certification cell

No actual screen reader or equivalent assistive-technology environment is available in this
workspace. Chrome accessibility-tree output is useful automation but is not a substitute for
manual AT operation. The packet therefore remains `implementing`; its archive task and the
manual screen-reader/certification claim remain open while independent Goal 3 work continues.
