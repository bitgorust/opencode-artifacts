# Artifact lifecycle and mutable local state

## Rollout boundary

- `COMPAT-03`, `OPS-05`: manifest and mutable-state schema 2 are explicit migrations. Empty
  and legacy preview stores remain on schema 1 unless an operator runs migration. Unknown,
  malformed, oversized, escaping, or ambiguous input fails before selection.
- The schema remains non-default because only the Ubuntu/ext4 write-platform observation is
  available; current/previous macOS and Windows native/WSL lock, migration, and fault cells
  remain unverified. The observation does not create a broad support claim.

## Identity, history, and publication

- `LIFE-01`, `LIFE-02`, `LIFE-07`: active artifacts are keyed by opaque UUID identity with a
  unique mutable slug. Every successful schema-2 create, update, and restore appends one
  immutable contiguous revision with full content hash, portable-page path, metadata,
  provenance, optional authoring-source reference, and deployment references.
- `LIFE-03`–`LIFE-05`: exact IDs, active slugs, contained registered paths, and recorded HTTP(S)
  URLs resolve without fuzzy guesses. Updates and restores require a matching expected head;
  stale results leave bytes unchanged and return bounded identity plus immutable merge input.
- `LIFE-04`: one fenced inter-process transaction selects page, revision, manifest, gallery,
  and source changes. Recovery rolls a prepared transaction back and a decided transaction
  forward; malformed internal journals and unsafe paths fail closed.

## State and lifecycle surfaces

- `LOCAL-04`, `SEC-07`, `PERF-05`: schema-2 decisions, comments, and collections use exact
  artifact-scoped envelopes, monotonic revisions, payload hashes, operation-ID replay records,
  CAS, rolling mutation limits, and encoded byte/count/field/depth ceilings. Distinct-document
  mutations merge under the transaction while same-document stale mutations conflict.
- `LIFE-06`, `UX-01`, `UX-04`, `UX-06`: the CLI and plugin expose list, status/read, auditable
  restore, preview-bound recoverable archive/unarchive, and checksummed directory export/import.
  Archive confirmation is one-use and head/state/deployment scoped. Irreversible deletion is
  not exposed. Plugin archive confirmation uses a distinct permission request.
- Authoring sources, local state, migration backups/reports, transactions, archive records,
  previews, and exported bundles are not copied into public-static staging by default.

## Compatibility and unavailable evidence

- `COMPAT-05`: legacy `version`, 12-character expected hash, `latest`, `state`, exact bare slug,
  and restore spelling remain accepted compatibility aliases. Under schema 2, history is
  unconditional, an existing-artifact publish without a precondition refuses, and restore
  requires the expected head. These public changes use the next pre-1.0 minor.
- `QUAL-02`, `QUAL-06`: the Node 24 full suite covers deterministic unit, model, multi-process,
  crash, migration, CLI, plugin, hostile-reference, bundle, and loopback behavior. A real
  two-tab Chromium run verifies visible decision/comment conflicts and a non-mutating quota
  refusal. Unavailable write-platform cells still prevent Phase 1 and local-artifact-core
  certification from passing across the target matrix.
