# Proposal: Run the blinded page-quality benchmark

## Outcome

A dated report preserves every required same-input generation, hard-gate result, blinded score
distribution, confidence interval, failure, and authorization fact, and permits an equal-or-
better claim only when every canonical threshold passes.

## Context

Renderer regression screenshots cannot establish comparative quality. The normative benchmark
requires current authenticated Claude Code Artifact references, at least three independent
generations per system and task, randomized/blinded pairs, at least three reviewers including
design/UX and technical perspectives, and both absolute and comparative thresholds.

## Scope

- In scope: capture/run manifests, authorization and retention metadata, deterministic
  randomization, reviewer packets, interaction traces, hard-gate automation, complete score
  aggregation, confidence limits, report generation, losing-archetype iteration, and claim
  gating against the frozen corpus.
- Out of scope: acquiring or using an account without explicit authority, committing private
  reference contents without retention permission, CI credentials, selecting best runs,
  automated judges as deciding reviewers, or lowering a failed threshold.

## Risks and rollback

- Risk: labels may leak, settings may be incomparable, reviewers may be conflicted, or retained
  outputs may violate subscription or redistribution terms.
- Rollback: invalidate the affected run or panel, retain the failure visibly, withdraw any
  claim, and rerun only after the authorization/settings/retention problem is resolved.

## Validation plan

Synthetic fixtures prove manifest completeness, blinding, deterministic randomization,
denominators, medians, majority logic, confidence calculations, and fail-closed claims. Real
verification remains blocked until a human supplies scoped Claude execution authority,
plan/model/settings metadata, output-retention permission, and at least three eligible
independent reviewers. All 48 generations per system (eight tasks times three runs across the
two required viewports/modes as captured states) and all failures remain in the dated record.
