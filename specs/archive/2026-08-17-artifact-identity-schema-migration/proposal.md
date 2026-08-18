# Proposal: Introduce durable artifact identity and schema migration

## Outcome

Give every local artifact a stable opaque identity and unconditional immutable revision
history, with a versioned metadata schema that upgrades all released local shapes without
losing or inventing content. A migration either produces a verified new store plus backup, or
leaves the old bytes selected and emits an actionable repair report.

## Context

The current manifest is unversioned, keys artifacts by slug, stores only revision numbers, and
silently replaces missing, malformed, or future-shaped manifests with an empty manifest.
History is optional, title-derived slug changes create a new identity, legacy files can be
omitted from metadata, and no backup/repair/rollback protocol exists. Phase 1 must freeze an
identity and metadata contract before rendering, packaging, collaboration, and export build on
it. The Phase 0 support matrix has no certified write-platform cells, so the new schema cannot
be default-enabled until the required filesystem evidence exists.

## Scope

- In scope: schema-versioned `ArtifactRecord` and `RevisionRecord` data; random opaque IDs;
  stable unique slugs as mutable references; immutable monotonically numbered revisions;
  complete metadata and provenance; validation; migration dry-run, backup, repair, resume,
  verification, rollback, and legacy fixtures for every released manifest/state shape,
  including historical Cloudflare shared-KV keys.
- Out of scope: the publication locking/commit algorithm (owned by
  `artifact-publication-transaction`); state CAS and quotas (owned by
  `artifact-state-cas-limits`); user-facing lifecycle commands and plugin arguments (owned by
  `artifact-lifecycle-surfaces`); real provider mutation; and promotion of an untested OS or
  filesystem to supported.

## Risks and rollback

- Risk: an upgrade could detach a stable page from its identity, invent history for missing
  files, overwrite an unknown future schema, cross-wire old Cloudflare state, or leave a
  partially selected schema after interruption. Platform-specific rename and durability
  behavior could make an otherwise passing migration unsafe.
- Rollback: preserve exact pre-migration bytes in a transaction-scoped backup, keep selection
  on the old schema until copy/validate completes, and provide an idempotent rollback that
  restores the verified backup and records the result. Unknown future schemas and ambiguous
  legacy data fail before mutation. New-schema default enablement remains off for any
  unverified write platform.

## Validation plan

Validation reviews representative create, rename, revise, repair, upgrade, and rollback
journeys against `LIFE-01`, `LIFE-02`, and `LIFE-07`. Verification uses table-driven fixtures
for every released shape, round-trip and idempotence properties, missing/corrupt/future-schema
cases, backup byte comparison, interruption at every migration boundary, and an explicit
legacy Cloudflare key mapping fixture. Exact supported-filesystem runs remain required before
default enablement and Phase 1 completion.
