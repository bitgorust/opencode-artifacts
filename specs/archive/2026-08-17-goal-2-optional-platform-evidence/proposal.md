# Proposal: Make cross-platform filesystem evidence optional for Goal 2

## Outcome

Goal 2 can complete from its verified Node 24, Ubuntu/ext4, migration, recovery, and browser
evidence without fabricating macOS or Windows results. Missing target-platform cells remain
visible and cannot create a support or default-enablement claim.

## Context

The technical Phase 1 gate passes, but the runbook currently makes unavailable macOS and
Windows native/WSL filesystem observations block all later goals. The user explicitly made
those Goal 2 evidence cells optional. The narrower gate must not weaken the separate support
matrix or schema rollout boundary.

## Scope

- In scope: Goal 2 completion semantics, Phase 1 status, and explicit treatment of unavailable
  platform evidence.
- Out of scope: declaring any platform supported, default-enabling schema 2, changing the
  product support matrix, or waiving platform/browser evidence for later certification gates.

## Risks and rollback

- Risk: readers could mistake optional goal evidence for a broad compatibility waiver. The
  runbook and current specs must explicitly prohibit that inference.
- Rollback: restore the cross-platform Goal 2 blocker and Phase 1 incomplete status; schema 2
  remains opt-in in either direction.

## Validation plan

Validate the user's explicit decision, retain the exact green Goal 2 evidence, and enforce in
repository tests that Goal 2 may pass while unverified cells remain optional and non-supporting.
