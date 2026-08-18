# Evidence: Add a contained offline asset pipeline

## Requirement: RENDER-04
- Validation: Phase 2 requires contained assets and a self-contained offline mixed-content page.
- Verification: `test/assets.test.ts` covers filesystem, MIME, SVG, alt, refusal/no-write,
  and expansion behavior; the mixed fixture was exercised offline in real Chromium 151.
- Result: passed for images, constrained SVG, and WOFF/WOFF2/TTF/OTF. After explicit approval,
  real offline Chromium loaded the embedded TTF under the narrow `font-src data:` directive
  with zero console entries and zero HTTP(S) requests.
- Evidence: [@test](test/assets.test.ts) [@manual](docs/evidence/renderer/goal-3-portable-assets-2026-08-17.md)

## Requirement: RENDER-05
- Validation: final output must retain the existing 15 MiB safety boundary after expansion.
- Verification: exact source, count, per-file, aggregate, encoded-contribution, rendered, and
  existing footer-expanded publication boundaries run in the automated suite.
- Result: passed; the offline mixed fixture rendered to 740,456 bytes below the 15 MiB cap.
- Evidence: [@test](test/assets.test.ts) [@test](test/gallery.test.ts) [@manual](docs/evidence/renderer/goal-3-portable-assets-2026-08-17.md)

## Requirement: SEC-02
- Validation: assets add an untrusted filesystem and active-content boundary.
- Verification: traversal, encoded separator, every-symlink, non-regular, content mismatch,
  changed-descriptor, bounded diagnostic, and exhaustive modeled authority cases.
- Result: passed; refused plugin inputs made no permission request and no publication write.
- Evidence: [@test](test/assets.test.ts) [@test](test/model/asset-pipeline-model.ts)
