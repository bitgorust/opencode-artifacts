# Evidence: Make mutable artifact state atomic and bounded

Common evidence: [@test](test/artifact-state.test.ts),
[@model](test/model/artifact-state-model.ts), [@test](test/plugin.test.ts), and
[@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md).

## Requirement: LOCAL-04
- Evidence: [@test](test/artifact-state.test.ts), [@test](test/plugin.test.ts), [@manual](docs/evidence/lifecycle/goal-2-browser-conflict-2026-08-17.png)
- Validation: approved artifact-scoped versioned state and CAS surfaces.
- Verification: decisions, comments, and collections share exact envelopes; distinct-document races retain both values.
- Result: Node 24 and real two-tab Chromium pass.

## Requirement: SEC-07
- Evidence: [@test](test/artifact-state.test.ts), [@manual](docs/evidence/lifecycle/goal-2-browser-conflict-2026-08-17.png)
- Validation: approved replay, serialization, and complete resource bounds.
- Verification: process races, replay conflict, body/shape/count/byte/depth/rate/wait bounds, and unsafe identities fail before mutation.
- Result: Node 24/Ubuntu-ext4 and real Chromium pass; other write-platform cells unavailable.

## Requirement: OPS-04
- Evidence: [@test](test/artifact-state.test.ts), [@test](test/plugin.test.ts), [@manual](docs/evidence/lifecycle/goal-2-browser-conflict-2026-08-17.png)
- Validation: approved typed stale/quota/rate/corrupt outcomes.
- Verification: bounded conflicts identify selected revision/hash and next action; corrupt/future stores never appear empty.
- Result: Node 24 full-suite and visible real-browser degraded-state pass.

## Requirement: PERF-05
- Evidence: [@test](test/artifact-state.test.ts), [@manual](docs/evidence/lifecycle/goal-2-browser-conflict-2026-08-17.png)
- Validation: approved documented defaults and four-times ceilings with an absolute rate ceiling.
- Verification: warning, hard rate, field, document, collection, thread, payload, envelope, and override boundaries are exercised.
- Result: Node 24 boundary and real-browser 413 pass; load/soak evidence remains later-phase work.

## Requirement: COMPAT-03
- Evidence: [@test](test/artifact-state.test.ts)
- Validation: approved exact legacy state migration.
- Verification: decision, comment, and collection payloads migrate under exact backup, rerun idempotently, and rollback without losing legacy bytes.
- Result: Node 24 fixture pass; hosted provider migration was not performed or claimed.

## Requirement: QUAL-02
- Evidence: [@test](test/artifact-state.test.ts), [@model](test/model/artifact-state-model.ts), [@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md), [@manual](docs/evidence/lifecycle/goal-2-browser-conflict-2026-08-17.png)
- Validation: approved model, process, plugin, HTTP, migration, and limit coverage.
- Verification: deterministic state/model/plugin diagnostics pass; a fixed-port loopback smoke passes.
- Result: Node 24 full-suite and real two-tab Chromium pass.

## Requirement: QUAL-06
- Evidence: [@test](test/artifact-state.test.ts), [@model](test/model/artifact-state-model.ts)
- Validation: approved adversarial stale/replay/schema/path/limit/overload coverage.
- Verification: future/corrupt/symlink/cross-artifact and controlled overload cases preserve selected state.
- Result: Node 24 full-suite and real-browser conflict/limit pass.
