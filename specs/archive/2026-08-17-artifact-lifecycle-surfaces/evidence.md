# Evidence: Expose complete artifact lifecycle operations

Common evidence: [@test](test/artifact-lifecycle.test.ts),
[@model](test/model/artifact-lifecycle-model.ts), [@test](test/cli.test.ts),
[@test](test/plugin.test.ts), and
[@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md).

## Requirement: LIFE-03
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@model](test/model/artifact-lifecycle-model.ts)
- Validation: approved expected-head append-only restore.
- Verification: restore adds one provenance-linked revision, preserves history, and stale restore refuses.
- Result: Node 24 full-suite pass.

## Requirement: LIFE-05
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@test](test/plugin.test.ts)
- Validation: approved exact references and bounded merge input.
- Verification: ID/slug/path/registered URL resolve exactly; stale updates return identity/head/source and do not write.
- Result: Node 24 full-suite pass.

## Requirement: LIFE-06
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@test](test/cli.test.ts), [@test](test/plugin.test.ts)
- Validation: approved consistent CLI/plugin lifecycle operations and recoverable archive.
- Verification: list/status/read/restore/archive/unarchive/export/import E2E diagnostics pass; irreversible delete is absent.
- Result: Node 24 CLI/plugin pass; packed-host evidence unavailable.

## Requirement: UX-01
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@test](test/cli.test.ts)
- Validation: approved identity/head/capability fields at decisions.
- Verification: shared status results expose ID, slug, revision/hash, local visibility, capabilities, and deployment references.
- Result: Node 24 CLI/plugin and real-browser state workflow pass.

## Requirement: UX-02
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@test](test/plugin.test.ts)
- Validation: approved bounded actionable degraded results.
- Verification: stale, absent, corrupt, incompatible, archive-conflict, and bundle errors state unchanged selection and next action.
- Result: Node 24 domain/plugin and visible real-browser degraded-state pass.

## Requirement: UX-04
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@test](test/plugin.test.ts)
- Validation: approved one-use scope-bound recoverable archive.
- Verification: preview covers head/state/bytes/deployments; changed scope and reused tokens refuse; explicit-slug unarchive preserves identity.
- Result: Node 24 CLI/plugin pass; human workflow review unavailable.

## Requirement: UX-06
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@test](test/cli.test.ts)
- Validation: approved checksummed directory bundle.
- Verification: full preflight rejects corrupt/unlisted/future/escaping/colliding content and round-trips revisions, sources, decisions, comments, and documents.
- Result: Node 24 full-suite pass.

## Requirement: SEC-02
- Evidence: [@test](test/artifact-lifecycle.test.ts)
- Validation: approved bounded exact resolution and bundle containment.
- Verification: traversal, encoding, backslash, symlink, foreign scheme, fuzzy title, ambiguity, hostile bundle path, and collision cases fail closed.
- Result: Node 24 full-suite pass.

## Requirement: COMPAT-05
- Evidence: [@test](test/artifact-publisher-v2.test.ts), [@test](test/cli.test.ts)
- Validation: approved one-minor aliases and safe changed semantics.
- Verification: version/hash/latest/state/restore/bare-slug aliases remain; schema-2 blind overwrite and restore without expected head refuse; package advances one minor.
- Result: Node 24 compatibility pass; packed-host evidence unavailable.

## Requirement: COMPAT-07
- Evidence: [@test](test/artifact-lifecycle.test.ts)
- Validation: approved semantic full-field bundle round trip.
- Verification: identity, revisions, provenance, source, selected head, and state compare equal after import; collisions reject.
- Result: Node 24 full-suite pass.

## Requirement: QUAL-02
- Evidence: [@test](test/artifact-lifecycle.test.ts), [@model](test/model/artifact-lifecycle-model.ts), [@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md)
- Validation: approved deterministic domain/CLI/plugin/model coverage.
- Verification: the common evidence exercises normal, failure, boundary, permission, compatibility, and hostile cases.
- Result: Node 24 full-suite pass; packed-host suite unavailable.
