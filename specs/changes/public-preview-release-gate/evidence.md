# Evidence: Decouple public preview from certification evidence

The product owner approved the proposal on 2026-08-16 after explicitly declining the human
study for this preview. The implementation retains missing and excluded results rather than
treating public preview as certification. The exact npm provider and post-publication results
remain pending and therefore keep the transition in `development`.

## Requirement: OUT-02

- Validation: `bitgorust` approved keeping the representative-user first-use baseline as a
  future certification gate rather than a public-preview gate.
- Verification: the transition property tests permit an `incomplete` OUT-02 result only with
  the preview, unsupported, uncertified, and missing-evidence disclosures present; the release
  record exposes zero eligible participants.
- Result: incomplete for certification and intentionally non-blocking for public preview.
- Evidence: [@test](test/release-integrity.test.ts),
  [@manual](docs/evidence/releases/2026-08-16-v0.14.4-preview.md)

## Requirement: OUT-03

- Validation: `bitgorust` approved retaining the representative-user comprehension study for
  future certification without substituting local Kimi/model sessions.
- Verification: the transition property tests permit an `incomplete` OUT-03 result only with
  missing evidence visible and reject certification until it passes; the release record keeps
  the participant count at zero.
- Result: incomplete for certification and intentionally non-blocking for public preview.
- Evidence: [@test](test/release-integrity.test.ts),
  [@manual](docs/evidence/journeys/phase-0-baseline-status.md)

## Requirement: OUT-04

- Validation: the approved proposal makes public preview a distribution state outside the
  accumulated certified capability levels.
- Verification: deterministic transition tests reject a preview certification claim and prove
  that certified local core cannot inherit preview labels, unsupported status, or missing
  OUT-02/OUT-03/support evidence.
- Result: pass for the implemented contract; exact release transition remains pending.
- Evidence: [@test](test/release-integrity.test.ts),
  [@manual](docs/requirements-traceability.md)

## Requirement: COMPAT-01

- Validation: the approved scope permits zero supported platform/browser cells only for an
  explicitly unsupported preview.
- Verification: governance claim checks require the README and support policy to expose
  unsupported/uncertified preview status, while the candidate record lists the full matrix as
  unverified.
- Result: pass for preview disclosure; incomplete for certification.
- Evidence: [@test](test/governance-policy.test.ts),
  [@manual](docs/support-policy.md)

## Requirement: DIST-03

- Validation: the approved design names a closed pre-publish and post-publish hard-gate set,
  exact tag/version coordination, and forward-only rollback.
- Verification: property tests reject every failed gate at its applicable transition; the tag
  workflow verifies tag/version agreement and retains exact release artifacts. Local tests,
  build, structural checks, package review, audit, licenses, and redistribution pass for the
  candidate. Exact npm trusted-publisher, registry-byte, signature, and provenance evidence is
  still pending.
- Result: partial; the candidate remains `development` and publication is blocked.
- Evidence: [@test](test/release-integrity.test.ts),
  [@manual](docs/evidence/releases/2026-08-16-v0.14.4-preview.md)

## Requirement: QUAL-08

- Validation: the approved proposal requires missing certification inputs to remain prominent
  and never become pass or not applicable.
- Verification: claim-consistency tests require the public-preview disclosures; the candidate
  record lists incomplete human, platform, accessibility, parity, performance, and operations
  evidence alongside every passing technical result.
- Result: pass for the candidate documentation; final release status remains pending.
- Evidence: [@test](test/governance-policy.test.ts),
  [@manual](docs/evidence/releases/2026-08-16-v0.14.4-preview.md)
