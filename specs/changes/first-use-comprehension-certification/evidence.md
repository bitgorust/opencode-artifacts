# Evidence: Certify first-use comprehension

## Requirement: OUT-02

- Validation: every claimed support cell needs one eligible unassisted first-time README-only pass.
- Verification: validator and aggregate tests enforce exact bytes/cell, eligibility, no assistance,
  600-second create/reopen, failure retention, and incomplete missing cells.
- Result: incomplete: zero eligible sessions and every target cell is missing.
- Evidence: [@test](test/journey-study.test.ts) [@manual](docs/evidence/journeys/goal-5-status-2026-08-19.md)

## Requirement: OUT-03

- Validation: at least ten eligible representative-primary users and a 90% all-four-fields pass rate are mandatory.
- Verification: aggregation tests reject rounding, imputation, incomplete fields, assistance,
  ineligible records, and denominators below ten.
- Result: incomplete: zero of ten required eligible participants.
- Evidence: [@test](test/journey-study.test.ts) [@manual](docs/evidence/journeys/goal-5-status-2026-08-19.md)

## Requirement: OUT-05

- Validation: consent, minimization, withdrawal, access control, and aggregate-only git retention
  are prerequisites to collection.
- Verification: schema tests reject direct identity, unknown/unbounded fields, missing consent,
  withdrawn records, and private data in aggregates; participant materials are frozen.
- Result: protocol pass; collection has not started because no study owner/recruitment is authorized.
- Evidence: [@test](test/journey-study.test.ts) [@manual](docs/journeys/goal-5-participant-materials.md)

## Requirement: COMPAT-01

- Validation: technical and human evidence must bind exact candidate bytes in every claimed cell.
- Verification: three exact-tarball OS command-line observations are retained and explicitly
  excluded from support; Windows 11/WSL, browser, mobile, and first-use cells remain absent.
- Result: incomplete with zero supported complete cells.
- Evidence: [@manual](docs/evidence/releases/2026-08-19-local-core-ci.md) [@manual](docs/support-policy.md)

## Requirement: QUAL-08

- Validation: missing humans, cells, failures, exclusions, and withdrawals must remain visible.
- Verification: the dated status records exact zero denominators and distinguishes automated
  technical observations from participants.
- Result: pass for fail-closed disclosure; the underlying outcomes remain incomplete.
- Evidence: [@test](test/journey-study.test.ts) [@manual](docs/evidence/journeys/goal-5-status-2026-08-19.md)
