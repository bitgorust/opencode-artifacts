# Proposal: Make artifact publication crash-safe across processes

## Outcome

Make create, update, restore, manifest mutation, revision retention, and gallery generation one
recoverable filesystem transaction across processes. Concurrent writers either serialize or
receive a typed stale refusal; interruption recovers a complete old or new logical state.

## Context

`FilePublisher` currently serializes only promises in one JavaScript process and writes the
stable page, optional version file, manifest, and gallery directly in sequence. Two processes
can both pass the stale check and lose updates, while a crash can expose mixed files. Restore
also performs multiple in-place writes. Phase 1 requires exact race and fault-injection proof
before later goals depend on the lifecycle store.

## Scope

- In scope: a dependency-free inter-process lock with fencing; bounded wait/cancellation;
  same-filesystem staging; durable transaction journal; atomic replacement and backups;
  startup/read recovery; typed stale, lock, commit, and recovery results; injectable fault
  points; and multi-process/model tests for same and different artifacts.
- Out of scope: identity/schema content (owned by `artifact-identity-schema-migration`),
  mutable comments/state/database transactions (owned by `artifact-state-cas-limits`), public
  lifecycle arguments (owned by `artifact-lifecycle-surfaces`), network filesystems without
  verified semantics, and any real deployment or provider mutation.

## Risks and rollback

- Risk: stale-lock takeover could create split-brain writers; a journal could be reordered or
  corrupted; an interrupted replacement could lose both copies; different-artifact writers
  could overwrite one another's manifest entry; or an OS/filesystem could violate assumed
  rename/durability semantics.
- Rollback: keep the existing store selected until an approved migration and platform gate
  pass. Every replacement retains a transaction-scoped old copy until the committed state is
  reopened and verified. Recovery uses a durable journal to roll forward a verified prepared
  generation or roll back from verified old copies; ambiguous/corrupt recovery refuses new
  writes and reports exact repair scope.

## Validation plan

Validation reviews stale-edit, concurrent publish, interrupted publish, and recovery output
for clarity and safe next actions. Verification spawns independent Node processes against one
directory, proves exactly one winner for the same expected head and no lost manifest entries
for different artifacts, injects failure before and after every filesystem boundary, and
compares implementation traces with the bounded transaction model. Supported write-platform
evidence remains mandatory for Phase 1.
