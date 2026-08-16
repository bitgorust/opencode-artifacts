# Proposal: Keep goal orchestration anchored to canonical specs

## Outcome

Long-running goal execution remains anchored to canonical product, roadmap, benchmark, and
traceability records, while rejected proposals can leave the active queue without being
misrepresented as delivered behavior or losing their rationale.

## Context

The goal runbook correctly separates execution into bounded goals, but repeats several exact
requirements, roadmap work items, and benchmark thresholds. Those copies can drift from their
canonical owners. The packet workflow also has no retained terminal state for a rejected or
abandoned proposal: only verified work can be archived.

## Scope

- In scope: make the runbook orchestration-only; link exact facts to canonical owners; add a
  recorded withdrawn packet state, command, validation, documentation, and tests.
- Out of scope: change product requirements, roadmap gates, benchmark thresholds, delivery
  phases, or verified-packet archival behavior.

## Risks and rollback

- Risk: withdrawal could bypass verification for delivered behavior, or an over-aggressive
  runbook edit could remove context needed to operate a goal.
- Rollback: revert the workflow command/status and restore the prior runbook summaries; no
  product or artifact data migration is involved.

## Validation plan

Validate that a draft packet with unresolved proposal content can be withdrawn with an actor,
date, and reason; that it moves to retained history without current-spec/evidence claims; and
that ordinary verified archival retains existing behavior. Review the runbook so each goal
retains its objective, packet boundaries, canonical gate link, and handoff without restating
normative details.
