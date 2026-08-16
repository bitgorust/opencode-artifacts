# Renderer dependency security and compatibility

## Current behavior

- `RENDER-02`: every checked-in example resolves through the approved patched ECharts and
  Vega renderer majors. Vega-Lite is compiled to Vega; malformed specifications become inline
  actionable errors. The intentionally malformed incident example remains explicitly expected.
- `SEC-02`: chart payload JSON is untrusted and script-context escaped. The exact candidate
  tests ECharts built-in tooltip encoding plus the cited Vega global-gadget and data-mutation
  payload classes.
- `SEC-04`: portable pages retain the strict on-disk CSP, make no view-time requests, and run
  Vega through its AST interpreter without `unsafe-eval`. The application stores neither a
  Vega View nor a debug gadget global.
- `DIST-04`: CI audits the clean lockfile, validates exact license dispositions, creates an
  SBOM and candidate provenance statement, packs once, and binds retained evidence to the
  candidate tarball. Release CI additionally verifies registry signature and provenance after
  publishing those same bytes.
- `DIST-05`: the renderer family is lockfile-pinned and its license, CSP/network, browser
  weight, update, and removal impacts are dated. Three exceptional license branches are bound
  to approved versions and exact file hashes. Already-generated pages remain functional after
  the installed package tree is removed.
- `QUAL-06`: deterministic tests and a real-browser smoke cover tooltip, expression/global,
  data-mutation, script-context, CSP, offline, resource, and candidate-gate boundaries.

## Evidence boundary

- `docs/evidence/governance/renderer-remediation-2026-08-16.md` records exact versions, hashes,
  package/SBOM/audit/signature results, browser observations, failures, and exclusions.
- `docs/license-dispositions.json` is the machine-readable maintainer decision. A version,
  branch, path, or hash change fails closed and needs new review.
- This evidence does not promote a supported OS/browser cell or prove an unpublished future
  registry attestation.
