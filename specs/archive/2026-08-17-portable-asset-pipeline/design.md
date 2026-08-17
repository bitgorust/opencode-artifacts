# Design: Add a contained offline asset pipeline

Required for high-risk changes.

## Context and constraints

Asset declarations are untrusted input crossing from Markdown into filesystem reads and then
into a strict-CSP portable file. Resolution must be independent of process cwd, never follow
an escaping symlink, never fetch, and account for encoded expansion before publication. The
existing 15 MiB final-page cap and credential scan remain authoritative.

## Chosen design

Parse asset references into typed declarations, reject absolute/URL/encoded traversal forms,
resolve from an explicit worktree root, and compare real paths for both the root and regular
file. Read with per-file and aggregate ceilings, identify allowlisted media from bytes, sanitize
active SVG into a constrained generated representation or refuse it, and produce data URIs with
declared MIME, byte hash, source-relative path, and alt-text status. Rendering returns a staged
result; publication applies footer expansion, scans final bytes, enforces the cap, and only then
enters the lifecycle transaction. Errors are bounded and contain paths/metadata, never bytes.

## Alternatives

- Emit ordinary relative URLs: rejected because strict CSP/offline removal would break them.
- Fetch or cache HTTP assets: rejected because it adds network authority, nondeterminism, and
  provenance/licensing risk.
- Trust filename extensions: rejected because mislabeled active content crosses the boundary.
- Permit raw SVG unchanged: rejected because scripts, external references, and parser features
  exceed the Markdown trust model.
- Inline first and check size afterward only: rejected because reads/base64 allocation also need
  pre-allocation bounds; both source and final representations are bounded.

## Trust, privacy, and failure boundaries

Only the explicit worktree root is readable. Symlinks, non-regular files, device paths, special
files, encoded separators, and changed-during-read identities fail closed. Diagnostics include
relative path, code, size, and next action but no asset body. Data URIs cannot request at view
time; the strict CSP stays unchanged. Private or credential-looking final content remains under
the existing scanner and explicit override contract. Unsupported/missing/external assets block
strict publication rather than yielding broken output.

## Migration, rollout, and rollback

Ship behind explicit declarations with no migration of existing HTML. Preflight and browser
offline evidence precede use in canonical fixtures. Rollback removes asset declaration support;
already-generated portable files remain self-contained. No schema/default-enable migration and
no destructive data operation is required.

## Formal-method decision

- Decision: bounded property model.
- Property and rationale: for every modeled reference and size boundary, the result is either a
  contained allowlisted immutable byte sequence whose encoded contribution is counted exactly,
  or a refusal with zero publication writes; no reference yields a view-time request.
- Model/evidence path: `test/model/asset-pipeline-model.ts` plus filesystem/symlink mutation and
  offline browser tests to be added during implementation.
