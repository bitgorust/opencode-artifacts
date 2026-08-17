# Tasks: Make artifact publication crash-safe across processes

- [x] Confirm proposal validation and human approval.
- [x] Implement the bounded fenced inter-process lock and typed lock outcomes.
- [x] Implement same-filesystem staging, durable journal, verified backups, commit, recovery,
  cleanup, and public-staging exclusions.
- [x] Route create, update, restore, and managed reads through recovery and the transaction.
- [x] Add deterministic fault injection and the bounded transaction state model.
- [x] Add independent-process same-head/different-artifact races, stale takeover, retry, path,
  corruption, cancellation, and resource-limit tests.
- [x] Retain exact supported-filesystem results and explicit unavailable cells.
- [x] Record validation/verification evidence and update `specs/current/artifact-lifecycle.spec.md`.
- [x] Run repository validation and archive the packet.
