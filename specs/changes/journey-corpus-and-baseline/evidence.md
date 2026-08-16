# Evidence: Establish the journey corpus and baseline study

## Requirement: OUT-02

- Validation: missing; no consented first-time-user run has been conducted.
- Verification: the approved corpus and validator are checked in; focused tests prove that no
  platform, uncovered platforms, and fewer-than-required evidence stay incomplete, while an
  observed covered miss fails.
- Result: missing, which is not a pass.
- Evidence: [@test](test/journey-study.test.ts),
  [@manual](docs/evidence/journeys/phase-0-baseline-status.md)

## Requirement: OUT-03

- Validation: missing; there are no results from ten consented representative primary users.
- Verification: focused tests exercise the exact ten-participant and 90% boundary, exclusion
  rules, fixture distribution, and the empty-study result.
- Result: missing, which keeps the Phase 0 gate failed.
- Evidence: [@test](test/journey-study.test.ts),
  [@manual](docs/evidence/journeys/phase-0-baseline-status.md)

## Requirement: OUT-05

- Validation: `bitgorust` approved the informed-consent, withdrawal, minimization, access, and
  retention protocol on 2026-08-16.
- Verification: validation rejects absent consent and unexpected identity fields; aggregation
  excludes withdrawn records and emits neither participant codes nor answer text.
- Result: pass for the Phase 0 study mechanism; no real participant data has been collected.
- Evidence: [@test](test/journey-study.test.ts), [@manual](docs/journeys/README.md)

## Requirement: UX-01

- Validation: participant use is missing; reconnect/export/archive/restore remain explicitly
  deferred rather than represented as shipped.
- Verification: the corpus validator requires create, revise, review, and share stages plus
  complete decision-state and fixture-rubric fields.
- Result: partial; the Phase 0 corpus is protocol-ready but real use and later lifecycle paths
  remain open.
- Evidence: [@test](test/journey-study.test.ts), [@manual](docs/journeys/corpus.json)
