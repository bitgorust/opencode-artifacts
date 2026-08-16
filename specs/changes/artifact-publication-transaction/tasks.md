# Tasks: Make artifact publication crash-safe across processes

- [ ] Confirm proposal validation and human approval.
- [ ] Implement the bounded fenced inter-process lock and typed lock outcomes.
- [ ] Implement same-filesystem staging, durable journal, verified backups, commit, recovery,
  cleanup, and public-staging exclusions.
- [ ] Route create, update, restore, and managed reads through recovery and the transaction.
- [ ] Add deterministic fault injection and the bounded transaction state model.
- [ ] Add independent-process same-head/different-artifact races, stale takeover, retry, path,
  corruption, cancellation, and resource-limit tests.
- [ ] Retain exact supported-filesystem results and explicit unavailable cells.
- [ ] Record validation/verification evidence and update `specs/current/artifact-lifecycle.spec.md`.
- [ ] Run repository validation and archive the packet.
