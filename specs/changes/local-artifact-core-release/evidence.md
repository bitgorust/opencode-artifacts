# Evidence: Certify the local artifact core release

## Requirement: OUT-04

- Validation: one immutable candidate must accumulate every phase and accountable sign-off.
- Verification: the model independently blocks every missing row, blocker, sign-off, claim, and
  digest mismatch; the exact candidate evaluates to `refused` with zero provider mutations.
- Result: refused because human, comparative, support, registry, and sign-off gates remain pending.
- Evidence: [@model](test/model/local-core-release-model.ts) [@manual](docs/evidence/releases/2026-08-19-local-core-candidate.json)

## Requirement: COMPAT-01

- Validation: diagnostic OS runs cannot become support without the complete browser/device and first-use cell.
- Verification: one shared tarball passes command-line observations on Linux, macOS, and Windows;
  the evidence names all missing Windows 11/WSL, previous macOS, browser, mobile, and human scope.
- Result: incomplete; zero supported platform IDs are claimed.
- Evidence: [@manual](docs/evidence/releases/2026-08-19-local-core-ci.md) [@manual](docs/support-policy.md)

## Requirement: DIST-03

- Validation: release surfaces must agree and absent publication authority must cause no mutation.
- Verification: the packaged claim audit and complete test suite keep public-preview,
  unsupported, uncertified, no-comparison language aligned.
- Result: pass for pre-release refusal; no tag, publish, deployment, or provider mutation occurred.
- Evidence: [@test](test/release-integrity.test.ts) [@manual](docs/evidence/releases/2026-08-19-local-core-claims.md)

## Requirement: DIST-04

- Validation: audit, license, SBOM, hashes, CI subject, and consumer verification must bind the exact tarball;
  registry integrity/signature/provenance require separately authorized publication.
- Verification: exact CI evidence, two isolated local packs, and three OS installs agree on SHA-256
  `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd`.
- Result: local supply-chain inputs pass; registry-derived inputs remain pending.
- Evidence: [@manual](docs/evidence/releases/2026-08-19-local-core-ci.md) [@manual](docs/evidence/releases/2026-08-19-local-core-consumer-verification.md)

## Requirement: QUAL-08

- Validation: every row, owner, exact-byte boundary, missing input, claim, and rollback must remain visible.
- Verification: the machine-readable record validates, resolves every row to pass/pending, names
  all blockers/sign-offs, disables certification/comparison/support, and records refusal.
- Result: pass for fail-closed decision quality; certification is refused.
- Evidence: [@test](test/model/local-core-release-model.ts) [@manual](docs/evidence/releases/2026-08-19-local-core-status.md)
