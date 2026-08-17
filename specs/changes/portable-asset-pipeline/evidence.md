# Evidence: Add a contained offline asset pipeline

## Requirement: RENDER-04
- Validation: Phase 2 requires contained assets and a self-contained offline mixed-content page.
- Verification: planned filesystem, MIME, SVG, offline-browser, and hostile-reference tests.
- Result: pending implementation and browser evidence.
- Evidence: [@manual](docs/roadmap.md)

## Requirement: RENDER-05
- Validation: final output must retain the existing 15 MiB safety boundary after expansion.
- Verification: planned exact source/encoded/footer/final boundary tests and byte reports.
- Result: pending implementation.
- Evidence: [@manual](docs/product-spec.md)

## Requirement: SEC-02
- Validation: assets add an untrusted filesystem and active-content boundary.
- Verification: planned traversal, symlink race, special-file, content mismatch, and resource tests.
- Result: pending implementation and model evidence.
- Evidence: [@manual](docs/threat-model.md)
