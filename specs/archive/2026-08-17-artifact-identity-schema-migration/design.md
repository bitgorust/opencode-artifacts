# Design: Introduce durable artifact identity and schema migration

Required for high-risk changes.

## Context and constraints

Slug-keyed manifest entries currently combine identity, presentation path, mutable head, and
partial history. Reads catch every error and return an empty manifest, which converts damage
or an unknown schema into apparent absence. The new contract must preserve directly openable
portable HTML, avoid a new dependency, tolerate interruption, and keep old data recoverable.
It must also allow later transactions and exports to use one canonical identity. No platform
may be claimed safe from unit tests on a different filesystem.

## Chosen design

Use manifest schema version 2. `ArtifactRecord` is keyed by a random UUID artifact ID and
contains the current unique slug, presentation metadata, created/updated timestamps, selected
head number, ordered `RevisionRecord`s, and deployment references. Each revision records its
monotonic number, immutable content hash, byte size, timestamp, provenance, author when known,
and stored portable-page reference. A validated slug index resolves paths without making the
slug identity. Duplicate IDs, duplicate active slugs, revision gaps/duplicates, mismatched
heads, invalid timestamps, unsafe references, and metadata/file hash disagreements are typed
errors rather than empty-store fallbacks.

Migration first inventories the old manifest and files without writing. It assigns one opaque
ID per recoverable legacy artifact, imports every existing numbered page in order, and imports
the stable head only when its bytes are not already represented. It never creates a revision
for an advertised file that does not exist; the repair report names missing, orphaned,
duplicate, corrupt, and irrecoverable entries. A canonical migration library also maps the
historical shared Cloudflare KV key shapes to site-scoped export records for later authorized
provider migration; deterministic fixtures exercise this without contacting a provider.

## Alternatives

Rejected: retaining slug as identity, because rename and URL changes would keep detaching
history. Rejected: deriving IDs from content, path, or title, because all can change and hashes
can reveal relationships. Rejected: treating malformed input as empty, because it destroys
the distinction between no data and damaged data. Rejected: in-place schema rewriting,
because a crash could destroy the only recoverable copy. Rejected: inferring missing revision
content from metadata, because that fabricates history.

## Trust, privacy, and failure boundaries

Manifest bytes, paths, metadata, timestamps, hashes, and legacy provider keys are untrusted.
Parsing is size-bounded and schema-exact; resolved file references remain inside the artifact
root. Migration writes neither provider state nor audience-visible data. Repair reports omit
page bodies, credentials, and raw provider values. A failed validation, ambiguous mapping,
unknown future version, backup error, or hash mismatch leaves the selected store unchanged.

## Migration, rollout, and rollback

The migrator has inspect, prepare, verify, select, and rollback phases. Prepare writes a
unique staged generation plus an exact backup and fsyncs the files/directories supported by
the platform adapter. Verify reopens and hashes the staged store. Selection is delegated to
the approved publication transaction primitive so interruption resolves to the complete old
or new store. Re-running inspect/prepare is idempotent; completed migrations report their
existing result. Rollback validates the backup before selection. Schema 2 remains opt-in on
write platforms without the roadmap's lock/migration/fault evidence.

## Formal-method decision

- Decision: property model plus exhaustive state-machine testing over bounded legacy stores
  and interruption points.
- Property and rationale: migration preserves every recoverable byte exactly once, never
  invents a revision, keeps artifact identity stable after selection, is idempotent, rejects
  future schemas without mutation, and selects either the complete old or complete new store.
- Model/evidence path: add a dependency-free model under `test/model/` and compare generated
  operation traces with filesystem migration tests; retain exact supported-platform fault
  reports under `docs/evidence/lifecycle/`.
