# Design: Make artifact publication crash-safe across processes

Required for high-risk changes.

## Context and constraints

The transaction spans several portable files, must preserve direct HTML access, and cannot
assume one process. Node provides atomic creation/rename primitives but no portable atomic
multi-file rename. The design therefore needs a recoverable commit protocol, a clear managed
visibility boundary, and filesystem-specific evidence. It must not add a dependency without a
separate approval, weaken the final-byte cap, or publish local lock/journal data.

## Chosen design

Add a lifecycle-store transaction primitive used by every managed read and mutation. An
atomic lock directory contains a unique owner token, process diagnostics, heartbeat, and
monotonic fencing generation. Waits are bounded and abortable. A takeover is allowed only
after the owner is provably gone or its lease is expired; the new fencing generation prevents
a resumed stale writer from committing. Ownership is revalidated before each visible step.

Within the lock, recovery runs first. A mutation reads and validates the selected state,
performs its expected-head check, renders all target bytes, and writes a unique same-filesystem
stage. It fsyncs supported files/directories, records hashes and old/new targets in a durable
journal, then atomically replaces individual targets with verified backups retained. The
journal records prepared, committing, committed, and cleaned states. The stable page is not
reported or returned until manifest, revision, gallery, and stable bytes reopen consistently.
All managed reads and server startup recover an unfinished journal before resolving a head;
public-static staging excludes lock, journal, backup, and temporary paths.

Recovery rolls forward only when every staged target matches the journal and the transaction
has a valid commit decision; otherwise it restores every verified old target. It is
idempotent and uses the fencing token. A corrupt or ambiguous journal fails closed with a
bounded repair result instead of guessing. The fault injector is an explicit internal
adapter, not timing-dependent test behavior.

## Alternatives

Rejected: the current in-memory promise queue, because it cannot serialize processes.
Rejected: a lock file without fencing, because a suspended stale writer can resume after
takeover. Rejected: direct sequential writes without a journal, because no deterministic
recovery decision exists. Rejected: cross-filesystem temporary paths, because rename loses
atomicity. Rejected: adding SQLite or a locking package at proposal time, because the target
can first be met with reviewed platform adapters and no new dependency.

## Trust, privacy, and failure boundaries

Paths, journal bytes, lock metadata, expected heads, and staged files are untrusted. Every
resolved target stays beneath the artifact root; symlinks and unexpected file types fail
closed. Journals and diagnostics contain names, hashes, sizes, and operation IDs but no page
bodies or credentials. Lock waits, transaction bytes, target count, recovery attempts, and
diagnostic output are bounded. Cancellation before commit leaves the old state; cancellation
after a commit decision completes recovery before returning.

## Migration, rollout, and rollback

Land the transaction primitive and fault/model tests behind the schema-2 opt-in path. Run
upgrade and crash recovery on each proposed write platform before default enablement. Existing
schema-1 publishing remains the selected fallback until its migration commits. Rollback first
recovers any journal, selects the verified old schema/store, and retains the failed transaction
report. A platform that cannot demonstrate the required atomic-create, rename, and durability
properties remains unverified and schema 2 stays disabled there.

## Formal-method decision

- Decision: explicit transaction state machine with exhaustive bounded trace exploration.
- Property and rationale: at most one writer commits for a given expected head; different
  artifacts do not lose manifest entries; a stale fencing token never commits; every injected
  interruption recovers to the full old or full new logical state; and recovery is idempotent.
- Model/evidence path: dependency-free model traces under `test/model/`, multi-process worker
  fixtures under `test/fixtures/`, and exact filesystem fault reports under
  `docs/evidence/lifecycle/`.
