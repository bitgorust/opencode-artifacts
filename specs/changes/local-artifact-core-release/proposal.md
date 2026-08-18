# Proposal: Certify the local artifact core release

## Outcome

One immutable candidate is either certified as local artifact core with a complete dated
requirements decision and exact-package evidence, or refused with every missing/failed gate
visible. Approval of this packet does not authorize a tag, npm publication, or provider change.

## Context

Goals 1-4 establish substantial local behavior, but a certified release accumulates Phases
0-3 and the recurring certification gate. It requires human outcomes, comparative quality,
supported platforms, migration, security/privacy, performance, clean-host/package, SBOM,
vulnerability/license, and claim-consistency evidence for the same candidate bytes. Prior
public-preview attestations cannot certify a new package.

## Scope

- In scope: freeze and hash the candidate; resolve every applicable requirement; run exact
  clean-host/browser/migration/security/performance/supply-chain gates; bind SBOM and
  provenance inputs; audit README/support/privacy/release claims; record owners, failures,
  rollback, support window, and a deterministic certify/refuse decision.
- Out of scope: publishing, tagging, changing trusted-publisher settings, silently accepting
  risk, converting missing evidence to not-applicable, certifying future bytes, or including
  Phase 4+ service/hosting/connector behavior in the claim.

## Risks and rollback

- Risk: evidence from different bytes is combined, a platform or human gate is hand-waved,
  publication outruns the decision, or a certified claim survives a failing prerequisite.
- Rollback: fail closed before mutation; keep the candidate unreleased/uncertified, preserve
  the refusal report, fix or re-scope through a newly approved packet, then rebuild and rerun
  all byte-bound gates. If a later provider mutation is proposed, request separate exact
  authority immediately before it.

## Validation plan

A machine-readable release record models candidate, evidence, and decision states and rejects
missing, stale, mismatched, failed, or inapplicable-without-reason rows. Verification runs the
full suite/build/check, exact tarball inspection, packed OpenCode/support matrix, browser and
accessibility QA, migrations/rollback, threat cases, benchmark and user-study gates, audit,
license, SBOM and provenance-input binding. Independent accountable-role sign-offs and the
absence of unresolved blockers are required before the decision can be `certified`.
