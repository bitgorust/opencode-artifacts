# Evidence: Make artifact publication crash-safe across processes

Common evidence: [@test](test/file-transaction.test.ts),
[@model](test/model/file-transaction-model.ts), and
[@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md).

## Requirement: LIFE-04
- Evidence: [@test](test/file-transaction.test.ts), [@model](test/model/file-transaction-model.ts)
- Validation: approved by `aaron.zeng` on 2026-08-16.
- Verification: independent-process races and every modeled write boundary recover one complete old or new publication.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform cells unavailable.

## Requirement: SEC-07
- Evidence: [@test](test/file-transaction.test.ts)
- Validation: approved bounded serialization, wait, cancellation, path, and resource controls.
- Verification: hostile path, symlink, target-count, byte, cancellation, and live-lock diagnostics pass.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform cells unavailable.

## Requirement: OPS-04
- Evidence: [@test](test/file-transaction.test.ts)
- Validation: approved typed safe-state outcomes.
- Verification: caught pre/post-decision failures name old selection or finish recovered new selection.
- Result: Node 24 full-suite pass.

## Requirement: OPS-05
- Evidence: [@test](test/file-transaction.test.ts), [@model](test/model/file-transaction-model.ts)
- Validation: approved staged rollout and recovery.
- Verification: prepared journals roll back and decided journals roll forward with hash verification.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform cells unavailable.

## Requirement: QUAL-02
- Evidence: [@test](test/file-transaction.test.ts), [@model](test/model/file-transaction-model.ts), [@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md)
- Validation: approved deterministic process/fault/model coverage.
- Verification: the common test and model evidence is independent of network and developer paths.
- Result: Node 24 full-suite pass; unavailable platform cells remain explicit.

## Requirement: QUAL-06
- Evidence: [@test](test/file-transaction.test.ts), [@model](test/model/file-transaction-model.ts)
- Validation: approved adversarial recovery coverage.
- Verification: malformed journals, unsafe transaction entries, replay/retry, resource exhaustion, and crash cases fail closed.
- Result: Node 24 full-suite pass; unavailable platform cells remain explicit.
