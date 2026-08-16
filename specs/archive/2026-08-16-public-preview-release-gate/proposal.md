# Proposal: Decouple public preview from certification evidence

## Outcome

Permit an explicitly uncertified public-preview source and npm release after exact security,
privacy, redistribution, package-integrity, and supply-chain gates pass, without converting a
missing representative-user study or full supported-platform matrix into a pass. Public
preview is a distribution state, not a certified capability level. OUT-02/OUT-03 and complete
platform evidence remain prerequisites only for a future supported local-artifact-core (or
later) certification.

## Context

The repository and npm package are already public, but the current Goal 1/Phase 0 contract
blocks all subsequent delivery and any new release on at least ten consented representative
participants and the complete target platform/browser matrix. The product owner has stated
that they will not run OUT-02/OUT-03 and wants public delivery to continue. Counting Kimi or
another model as representative people would contradict the approved study protocol and
fabricate evidence. A separate, visibly unsupported preview state lets engineering and public
inspection continue without making that false claim.

## Scope

- In scope: distinguish public preview from certified release levels; change the Phase 0 and
  Goal 1 stopping conditions; qualify OUT-02, OUT-03, COMPAT-01, DIST-03, and QUAL-08 release
  applicability; add a machine-checked release-state/property model; update README, support,
  traceability, roadmap, runbook, release evidence, and current specs; prepare an authorized
  preview release only after the hard provider and exact-byte gates pass.
- Out of scope: calling a model a human participant; claiming support, production readiness,
  parity, or a certified local artifact core; weakening CSP, secret scanning, vulnerability,
  license, redistribution, provenance, or package-integrity gates; fabricating platform
  results; changing runtime APIs; or treating a preview as an accumulated prerequisite for a
  later certified level.

## Risks and rollback

- Risk: users may interpret a public package as supported; missing usability research may
  persist indefinitely; an npm version cannot be reused or fully recalled after publication;
  and a permissive preview transition could accidentally bypass a security or supply-chain
  gate. Controls are an explicit preview label at every release surface, zero supported-cell
  claims, a closed hard-gate allowlist, a property model, exact evidence, and refusal to
  promote preview evidence into certification.
- Rollback: disable future preview tags, restore the certification-only gate through a new
  approved packet, deprecate any affected npm version, and publish a corrective version and
  notice. Already downloaded bytes and third-party copies cannot be revoked, so rollback is
  forward-only and must remain visible in release evidence.

## Validation plan

The product owner's explicit refusal to conduct the human study and direction to permit public
delivery validates the product decision. Verification requires deterministic transition tests
showing that public preview accepts missing OUT-02/OUT-03/support evidence only when it remains
visibly incomplete, rejects every failed hard gate, and can never be labeled supported or
certified. A completed preview release record, exact CI/package outputs, provider readback,
registry digest, and provenance verify the first real transition.
