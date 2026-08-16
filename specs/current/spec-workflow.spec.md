# Spec-anchored workflow

This current specification describes repository-development behavior, not artifact product
behavior. The target and engineering owners remain `docs/product-spec.md` and
`docs/engineering-principles.md`.

## Goal orchestration

- `OUT-06`: `docs/goal-runbook.md` owns goal boundaries, ordering, checkpoints, and handoffs.
  Exact product behavior, phase work/gates, traceability, quality thresholds, current shipped
  behavior, and change evidence remain owned by the canonical records named in its precedence
  table. A conflicting runbook summary does not override them.
- Recommended packet names are review boundaries, not requirements. The proposal imports the
  current canonical requirement IDs and may be split when evidence or approver boundaries
  require it.

## Packet disposition

- `QUAL-01`: a verified packet passes proposal, approval, implementation, task, evidence, and
  current-spec gates before it moves to archive with status `archived`.
- A draft, approved, or implementing packet that has not updated current truth may be withdrawn
  with an actor and non-empty reason. It moves to the dated archive with status `withdrawn`,
  preserving incomplete proposal material as non-delivered decision history.
- Withdrawal does not require resolved deltas, completed tasks, implementation evidence, or
  current-spec updates and cannot satisfy a product or release claim. Verified packets and
  packets claiming current-spec updates refuse withdrawal.
