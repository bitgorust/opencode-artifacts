# Evidence: Introduce durable artifact identity and schema migration

Common evidence: [@test](test/artifact-schema.test.ts),
[@test](test/artifact-migration.test.ts),
[@test](test/artifact-publisher-v2.test.ts), and
[@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md).

## Requirement: LIFE-01
- Evidence: [@test](test/artifact-schema.test.ts), [@test](test/artifact-migration.test.ts)
- Validation: approved opaque identity and mutable unique slug.
- Verification: create, migration, update, and rename preserve UUID identity; collisions refuse.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform cells unavailable.

## Requirement: LIFE-02
- Evidence: [@test](test/artifact-publisher-v2.test.ts), [@test](test/artifact-migration.test.ts)
- Validation: approved unconditional immutable history.
- Verification: schema-2 create/update/restore append contiguous retained revisions, including legacy materialization without invented bytes.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform cells unavailable.

## Requirement: LIFE-07
- Evidence: [@test](test/artifact-schema.test.ts)
- Validation: approved exact versioned metadata.
- Verification: exact validators reject duplicate/mismatched identity, slug, head, path, hash, timestamps, and future schemas.
- Result: Node 24 full-suite pass.

## Requirement: OPS-03
- Evidence: [@test](test/artifact-migration.test.ts)
- Validation: approved exact verified backup and restore.
- Verification: migration retains exact manifest/index/page/state bytes and the rollback drill selects the original bytes.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform restore drills unavailable.

## Requirement: OPS-05
- Evidence: [@test](test/artifact-migration.test.ts)
- Validation: approved inspect, prepare, verify, select, post-verify, and rollback.
- Verification: source changes and failed verification refuse selection; rerun completes or reports current selection.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform fault evidence unavailable.

## Requirement: OPS-07
- Evidence: [@test](test/artifact-migration.test.ts), [@test](test/cli.test.ts)
- Validation: approved bounded repair/progress and resumability.
- Verification: inspect reports issues without bodies, apply resumes, completed migration is idempotent, and CLI rollback is explicit.
- Result: Node 24 full-suite pass.

## Requirement: COMPAT-03
- Evidence: [@test](test/artifact-migration.test.ts)
- Validation: approved forward schema migration and future-version refusal.
- Verification: released unversioned fixtures and historical shared-KV shapes map losslessly or emit explicit repair items; future schemas do not mutate.
- Result: Node 24 fixture pass; provider mutation was not performed or claimed.

## Requirement: COMPAT-04
- Evidence: [@test](test/artifact-migration.test.ts), [@test](test/artifact-state.test.ts)
- Validation: approved preservation of identity and association.
- Verification: local state associations follow opaque IDs, ambiguous records refuse, and rollback restores prior selection.
- Result: Node 24/Ubuntu-ext4 pass; other write-platform cells unavailable.

## Requirement: QUAL-02
- Evidence: [@test](test/artifact-schema.test.ts), [@test](test/artifact-migration.test.ts), [@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md)
- Validation: approved deterministic schema/migration/rollback coverage.
- Verification: the common fixture diagnostics cover normal, failure, boundary, idempotence, and hostile paths.
- Result: Node 24 full-suite pass; unavailable platform cells remain explicit.
