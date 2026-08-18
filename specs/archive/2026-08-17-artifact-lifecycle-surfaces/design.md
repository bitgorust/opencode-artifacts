# Design: Expose complete artifact lifecycle operations

Required for high-risk changes.

## Context and constraints

Lifecycle semantics must be shared without expanding the deployment `Publisher` interface,
which currently owns only `publish`. References arrive from users/agents and are untrusted;
paths and URLs can be ambiguous or hostile. OpenCode tool arguments are public API and require
explicit approval. The package is pre-1.0 but still follows SemVer and notice rules. Exported
portable pages must survive package removal, while local state and authoring sources must not
silently enter public-static deployment trees.

## Chosen design

Add a local `ArtifactLifecycleStore` over the approved identity, transaction, and mutable-state
primitives. `ArtifactRef` accepts an opaque ID, a contained stable/revision HTML path, or an
exact URL recorded in deployment references. A bare slug remains an exact deprecated lookup
through the unique slug index for current CLI compatibility; fuzzy title/slug guesses and
unregistered URLs are refused. Results use a bounded versioned domain shape shared by CLI and
plugin formatters.

Create omits `artifact`; update supplies `artifact` plus `expectedRevision` or `expectedHash`.
If a legacy title-derived create collides with an existing slug without a precondition, it
returns a conflict rather than overwriting. `version` remains accepted but history is always
created. Each revision retains the portable HTML and, when publication originates from the
renderer, its input format and exact authoring source in a non-public history area. A stale
result includes ID/slug/head/hash/metadata and current source inline up to 256 KiB; larger
sources return a transaction-pinned immutable source path plus bounded beginning/end preview,
so the same session can read and merge without rediscovering identity.

Restore resolves a historical revision and commits its bytes/source as a new head revision
whose provenance names the restored-from revision; no pointer rewinding or history deletion
occurs. Archive preflight returns ID, slug, revision/state counts, bytes, deployment references,
and recovery behavior plus a one-use transaction-bound confirmation token. Confirmed archive
moves the complete logical artifact into the internal archive namespace and removes active
references/gallery entries atomically; unarchive resolves slug conflicts explicitly.

Export is a schema-versioned directory bundle containing a checksummed manifest, portable
pages, all revisions, metadata/provenance, authoring sources when present, comments, decisions,
and supported documents. It is staged and verified before selection. Import validates schema,
paths, hashes, sizes, identity collisions, and representability without mutation, then commits
atomically with an explicit collision policy; unknown future schemas fail. Public deployment
adapters continue excluding source, mutable-state, archive, transaction, and backup areas.

CLI adds `list`, `status`, `read`, `archive`, `unarchive`, `export`, and `import`, while keeping
`latest`, `state`, and the old restore spelling as aliases. Plugin adds approved `artifact` and
`expectedRevision` publish arguments, CAS arguments to mutable tools, and one
`artifact_lifecycle` operation tool. Archive requires an `artifact_archive` `ctx.ask` scoped to
the exact opaque ID and confirmation token. The base `Publisher` interface does not change.

## Alternatives

Rejected: fuzzy title/slug matching, because it can mutate the wrong artifact. Rejected:
rewinding the head pointer for restore, because it erases the audit meaning of revisions.
Rejected: immediate delete, because recoverable archive is safer and the target does not yet
require irreversible local deletion. Rejected: ZIP/tar or a new archive dependency, because a
checksummed directory bundle is inspectable and portable without new code authority. Rejected:
one overloaded `artifact_publish` operation enum, because read/lifecycle authority and
publication input would become harder to review.

## Trust, privacy, and failure boundaries

Artifact refs, paths, URLs, bundles, metadata, source, state, confirmation tokens, and operation
IDs are untrusted. Resolution requires exact normalized containment and rejects symlink escape,
encoded traversal, unsupported schemes, duplicate matches, and foreign deployment URLs.
Results cap lists, source previews, state/doc previews, errors, and diagnostics; secrets are
scanned before export across an audience boundary. Archive authority is distinct from publish,
tokens are single-use and bound to current head/scope, and failures state that nothing changed.

## Migration, rollout, and rollback

Implement only after all four Goal 2 packets are approved. Add read/list/status first, then
stale-protected create/update, restore, archive/unarchive, and export/import on the transaction
store. Keep compatibility aliases with deprecation output through at least one supported
minor; changed update semantics ship only in a new minor. Rollback disables new mutations,
recovers any transaction, selects the verified prior schema/store, and leaves portable HTML
readable. Export/import and archive remain unavailable if full-state verification fails.

## Formal-method decision

- Decision: reference-resolution and lifecycle state-machine property model.
- Property and rationale: an accepted reference resolves exactly one artifact; stale updates
  never write; restore adds exactly one revision; archive is reversible and preserves all
  associated data; import is all-or-nothing; export/import round-trip every representable
  field; and confirmation tokens cannot authorize a different head or artifact.
- Model/evidence path: dependency-free lifecycle traces under `test/model/`, CLI/plugin E2E and
  hostile bundle/reference fixtures, plus retained browser/manual workflow evidence under
  `docs/evidence/lifecycle/`.
