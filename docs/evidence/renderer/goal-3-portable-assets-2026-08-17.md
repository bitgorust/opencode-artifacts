# Goal 3 portable asset evidence — 2026-08-17

Scope: implementation evidence for `portable-asset-pipeline` on the Goal 3 branch. This is a
renderer observation, not a supported-platform or accessibility certification.

## Automated boundary evidence

Environment: official `node:24-bookworm`, Node 24.19.0, npm 11.7.0, container network disabled.

- `npm run build`: passed.
- `npm test`: 181/181 passed at the final packet gate; the focused asset suite passed 11/11.
- `npm run check`: all 35 registered structural checks passed.
- `test/assets.test.ts`: contained PNG expansion and hash, explicit decorative semantics,
  constrained SVG reconstruction, active SVG refusal, external/traversal/encoded path
  refusal, every-symlink refusal, non-regular/missing/MIME mismatch refusal, exact source/count/
  file/final boundaries, descriptor mutation detection, WOFF/WOFF2/TTF/OTF typing, synchronous broken-URL
  prevention, plugin no-write refusal, and plugin expanded-byte publication.
- `test/model/asset-pipeline-model.ts`: exhaustively enumerates 32 authority/property masks
  across seven byte boundaries. Every result either returns the exact base64 contribution for
  a contained stable regular allowlisted sequence or refuses with zero returned source bytes
  and zero view-time requests.
- Existing `test/gallery.test.ts` and lifecycle tests retain the footer-expanded 15 MiB refusal
  before transactional write.

Diagnostics carry only a bounded relative path, code, size metadata, and next action. They do
not carry asset bytes.

## Real offline browser observation

Fixture: `examples/patterns/portable-mixed.md`, rendered by the built CLI to a 740,456-byte
file containing a local PNG, Vega-Lite chart, table, and decision buttons.

Harness: `scripts/portable-browser-evidence.ts` against Selenium standalone Chromium 151 at a
1440 × 1600 viewport. CDP network emulation was set offline before navigation. The retained
mixed-page machine-readable report is
[`goal-3-portable-assets-chromium-2026-08-17.json`](goal-3-portable-assets-chromium-2026-08-17.json)
and the retained visual is
[`goal-3-portable-assets-chromium-2026-08-17.png`](goal-3-portable-assets-chromium-2026-08-17.png).
The loaded-font report and visual are
[`goal-3-portable-font-chromium-2026-08-17.json`](goal-3-portable-font-chromium-2026-08-17.json)
and
[`goal-3-portable-font-chromium-2026-08-17.png`](goal-3-portable-font-chromium-2026-08-17.png).

Observed:

- document ready and useful chart content in 669 ms in the final single non-benchmark run;
- embedded image complete at natural width 1011 with the expected exact SHA-256;
- one chart visual, one table, and two decision buttons present;
- Enter selected the focused decision button through WebDriver keyboard actions;
- zero browser console entries;
- request inventory contained only the `file:` document and embedded `data:image/png`; zero
  HTTP(S) requests occurred;
- on-disk CSP was `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
  img-src data:; font-src data:; connect-src 'none'`.

## Embedded-font observation

After explicit CSP-change approval, a separate temporary fixture embedded the OS-packaged
DejaVu Sans Mono TTF from an explicit read-only font root. The font bytes were not retained in
the repository. Offline Chromium reported the `Artifact Project` font face as `loaded`, used
it as the computed body family, emitted zero console entries, and requested only the `file:`
document plus its `data:font/ttf` resource; HTTP(S) requests remained zero.

Mobile, keyboard traversal beyond the exercised control, screen reader, and supported-browser
evidence belong to the later Goal 3 accessibility packet and remain unverified.
