# Renderer dependency remediation — 2026-08-16

Status: implementation checkpoint. Local candidate gates pass; exact-commit GitHub Actions
candidate provenance and artifact retention are pending the first pushed implementation commit.
This is not a package release or a supported-platform claim.

## Approval and dependency identity

`bitgorust` approved `supply-chain-vulnerability-remediation` at
2026-08-16T14:57:27Z. The installed and lockfile-resolved renderer family is:

| Package | Before | Candidate |
| --- | ---: | ---: |
| `echarts` | 5.6.0 | 6.1.0 |
| `vega` | 5.33.1 | 6.4.0 |
| `vega-lite` | 5.23.0 | 6.4.3 |
| `vega-embed` | 6.29.0 | 7.1.0 |
| `vega-functions` | vulnerable line | 6.2.0 |
| `vega-interpreter` | vulnerable line | 2.3.2 |

The candidate addresses the audited ECharts tooltip, Vega global-gadget, and Vega `setdata`
advisory classes. `npm audit --package-lock-only --json` under Node 24.19.0 and npm 12.0.2
reported zero findings at every severity.

## License gate

`docs/license-dispositions.json` records the approved, exact hash-bound choices. The gate reads
installed package manifests when lockfile metadata is absent, then fails if a disposed version,
declared branch, selected branch, file path, or digest changes.

| Package | Approved branch | Exact license-file SHA-256 |
| --- | --- | --- |
| `khroma@2.1.0` | MIT | `66b333b0f66759a0b710459e03f7029abe17f4358114a128d2c972e642961b49` |
| `dompurify@3.4.13` | Apache-2.0 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `json-schema@0.4.0` | BSD-3-Clause | `4e053c510d6f3e4724213a292c65142df68d069c40f558582bc4270914e16f77` |

The candidate inventory contains 217 lockfile package entries. The only missing-metadata and
compound entries are exactly the three approved dispositions; `npm run check:licenses` exits 0.

## Deterministic and adversarial verification

- All canonical examples render through the upgraded family; the intentionally malformed
  `examples/incident-report.md` block remains the sole expected inline chart error.
- ECharts' built-in HTML tooltip builder encodes attacker-controlled header, name, and value.
- Vega parses and runs through the AST interpreter without invoking the `Function` constructor.
- The application does not retain a Vega View or `VEGA_DEBUG` global and catches asynchronous
  Vega embed failures into the inline error surface.
- The table-driven release model blocks the candidate when any audit, license, CSP, offline,
  adversarial-payload, compatibility, or packed-byte constituent is false.

These checks are implemented in `test/renderer-security.test.ts`,
`test/release-integrity.test.ts`, and `test/render.test.ts`.

## Real Chromium smoke

Temporary Playwright 1.62.1 drove an already cached Chromium 145.0.7632.6 headless shell. The
browser is an observed test tool, not a promoted support-matrix cell. The normal fixture was
`examples/patterns/tune-controls.md`; the adversarial fixture contained the cited Vega
global-gadget/`setdata` forms and an ECharts Lines-series tooltip name with an image `onerror`.

Results:

- two of two charts rendered in each page from `file://`;
- zero unexpected requests, console errors, page errors, or dialogs;
- CSP remained `connect-src 'none'` with no `unsafe-eval`;
- `VEGA_DEBUG` and an application Vega View global were both absent;
- alert and ECharts `onerror` sentinels remained untouched before and after forced tooltip display;
- tooltip DOM contained no raw attacker image;
- Tab/Enter toggled the theme and ArrowRight changed the Vega range control;
- at 390 CSS pixels, document width stayed 390 and chart widths stayed within the viewport.

Screenshot: [interactive renderer smoke](renderer-upgrade-chromium-2026-08-16.png).

## Weight, packing, and removal

Against commit `a6f983c`, the same interactive example grew from 1,639,717 to 1,732,941 bytes:
93,224 bytes (5.7%), remaining far below the 15 MiB artifact cap. Runtime bundle totals grew
from 1,609,974 to 1,703,083 bytes. The npm 9 comparison tarball grew from 49,996 to 50,016
bytes and retained the same 43-file package surface.

The npm 12 exact local candidate contained 43 files, 50,141 packed bytes, and 179,462 unpacked
bytes. Its SHA-256 was
`eb926c9073efd6f90b44cd8dfd5c1fed49ad1ec695744a71259dbb3aca42c103`; pack SRI was
`sha512-njtqMVW0AEDSFO+n7mnLvYflUar1yeGUHzvP55RpqQPb9sQoVeFCbhGF6Yql26kKNT4v4ZLwebNrPS3oZ2vYAA==`.
Because gzip output can vary by npm tool version, CI binds and retains its own exact tarball
rather than comparing this local digest to a later run.

A clean temporary install generated the interactive page from that candidate tarball. The
entire installed `node_modules` tree was then moved away. Chromium still rendered both charts
with zero requests or errors; the retained HTML SHA-256 was
`ecd54d8a7d6eee16251a4f275c297692e18abdf413572707bc1da9b201f0a9e9`.

## SBOM, signatures, and provenance boundary

- CycloneDX 1.5: 211 components and 212 dependency nodes; output SHA-256
  `7d65df5d9d1626c3225ea03160d5192804b3908506c599f10dc6d86f060d2d22`.
- Registry verification: 212 package signatures and 22 attestations passed; output SHA-256
  `462af43efa2bc413d42bd0cf7981188e1201c16a0ef8082aa94a6e6422cda4b8`.
- Audit output SHA-256:
  `1a6880655b7fe998c3f6cb838d1afedac09b478a552e3f1f38bff5a0416b74b8`.
- License output SHA-256:
  `4bc307c41b17ccdc6e6590f6f940939033b86cf3444617abeb2b0f356e101cea`.

CI now accepts both npm pack JSON shapes used by current tooling, generates a SLSA v1
candidate provenance statement bound to tarball SHA-256, source commit, workflow reference,
and run attempt, and uploads the statement, SBOM, audit, signature, license, pack coordinate,
and tarball together. Release CI packs before those gates, publishes that exact tarball only
after they pass, and still verifies registry signature/provenance afterward.

No registry package or provider setting was changed. The local checkpoint cannot prove the
future exact-commit CI run or npm registry provenance; those remain visibly pending.

## Retained failed and excluded observations

- An initial `npm test` used unsupported system Node 18 after dependency installation removed
  an extraneous Node 24 binary; TypeScript test loading failed before product tests ran. Under
  the supported Node 24.19.0 binary, all renderer, release-integrity, build, and structural
  checks passed. The local filesystem sandbox suppressed child-process stderr in the two CLI
  tests and triggered a native Node async assertion in the server test; both anomalies reproduce
  unchanged at base commit `a6f983c`, while the exact same Node version passed the full suite in
  the preceding GitHub Actions run. The pushed exact-commit run remains the authoritative full-
  suite verdict for this checkpoint.
- A new Chromium download stalled without output and was stopped. The smoke used the exact
  pre-existing cached browser identified above.
- Browser launch inside the filesystem sandbox failed on Linux sandbox syscalls. The approved
  unsandboxed browser process then produced the recorded pass; no result was inferred from the
  failed launches.
- Firefox, Safari, mobile browsers, screen readers, clean OpenCode host registration, registry
  publication, and trusted-publisher configuration were not exercised here.
