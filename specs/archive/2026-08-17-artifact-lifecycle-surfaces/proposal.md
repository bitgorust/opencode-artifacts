# Proposal: Expose complete artifact lifecycle operations

## Outcome

Expose one coherent local lifecycle through CLI and OpenCode: exact artifact references,
create/update with stale protection, list/status/read, auditable revision restore, recoverable
archive/unarchive, and validated versioned export/import. Every result identifies artifact,
head, hash, visibility/capability, unchanged state on failure, and the next safe action.

## Context

The CLI currently renders by title-derived slug, restores by bare slug/version, reports only
the latest artifact, and reads decision state. The plugin exposes publish plus separate DB,
state, and comment tools but no artifact list/read/status/restore/archive/export/import. Update
identity is inferred from title, history is optional, stale metadata is incomplete, archive is
absent, and no portable lifecycle bundle exists. Goal 2 must freeze these contracts for Goals
3, 4, and 6.

## Scope

- In scope: exact ID/contained path/registered URL reference resolution plus deprecated exact
  bare-slug compatibility; required expected revision/hash for updates; stable structured
  domain results; full CLI and plugin lifecycle operations; auditable restore as a new
  revision; archive preview/confirmation/unarchive; schema-versioned directory export/import;
  retained authoring source for stale merge; and SemVer/deprecation documentation.
- Public API proposed for approval: add `artifact` and `expectedRevision` to
  `artifact_publish`; retain `version` as a deprecated no-op and `expectedHash` as a supported
  compatibility precondition; add `expectedRevision`/`operationId` where state/comment/DB
  mutations require CAS; add an `artifact_lifecycle` tool with bounded operations and an
  `artifact_archive` permission checkpoint. The `Publisher` interface is not changed.
- Out of scope: hosted lifecycle, audience/deployment permissions, structured OpenCode host
  result integration and reopen fallback (Goal 4), event collaboration (Goal 6), irreversible
  deletion, release, real deployment, and provider-side import/export.

## Risks and rollback

- Risk: reference parsing could target the wrong artifact or escape the root; restore could
  destroy history; archive could orphan state; export could omit private/local data or leak it
  to public staging; import could partially mutate; and public tool-argument changes could
  break existing agents or scripts.
- Rollback: keep existing CLI spellings and tool arguments as documented compatibility
  aliases for at least one supported minor; use a new pre-1.0 minor for changed update
  semantics; implement archive as a reversible transaction; validate an entire import before
  mutation; and roll back selected schema/store using the approved lifecycle transaction.
  If lifecycle surfaces cannot safely initialize, existing portable HTML stays readable and
  all mutations fail closed.

## Validation plan

Validation follows documented create, revise, stale merge, rename, restore, archive/unarchive,
export, and import journeys through both CLI and plugin, including preview and failure text.
Verification covers exact/fuzzy/hostile references, stale payload bounds, immutable restore,
archive recovery, export round trips, corrupt/unknown bundles, old argument compatibility,
permission denial, and packed CLI/plugin behavior. Human approval of the listed public tool
arguments and permission name is required before implementation.
