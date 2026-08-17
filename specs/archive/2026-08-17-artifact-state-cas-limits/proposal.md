# Proposal: Make mutable artifact state atomic and bounded

## Outcome

Make local decisions, comments, and mini-database mutations atomic and concurrency safe, with
explicit schema/revision CAS semantics, bounded live conflict payloads, and enforced document,
collection, thread, body, and mutation-rate limits.

## Context

The local server and plugin currently perform unprotected read-modify-write operations on JSON
files. Concurrent clients/processes can lose answers, threads, or documents. Most parse errors
become empty stores, writes are in place, collections have no count/total-byte limit, and no
request-rate limit exists. Cloudflare's historical KV handlers use the same shape but cannot
provide strong CAS; their data requires explicit migration treatment rather than being cited
as Phase 1 proof.

## Scope

- In scope: versioned decision/comment/document envelopes; per-store monotonic revisions and
  content hashes; compare-and-swap and create-only preconditions; atomic mutation via the
  approved lifecycle transaction primitive; bounded conflict responses; strict validation;
  configurable defaults and hard override ceilings; warning/hard-limit diagnostics; local
  HTTP/plugin parity; legacy-shape migration; and process/client race tests.
- Out of scope: hosted strong-state architecture, treating Cloudflare KV as CAS-capable,
  datasource execution, live event/reconnect behavior, connector state, provider mutation,
  and the final public plugin-tool argument design (owned by `artifact-lifecycle-surfaces`).

## Risks and rollback

- Risk: a compatibility fallback could silently bypass CAS; concurrent writes to different
  documents could still lose changes; oversized conflict payloads could leak or exhaust
  resources; schema migration could detach state from artifact identity; or rate limiting
  could make local authoring unusable.
- Rollback: back up each legacy store before schema selection, keep old shapes read-only until
  verified migration, and roll back through the lifecycle transaction. Conflict or limit
  failures never mutate. The old unsafe write path is not a rollback option after schema 2 is
  selected; disabling mutable service routes is the safe fallback.

## Validation plan

Validation exercises two-client edit/merge/refusal journeys and checks that errors state the
live revision, unchanged data, limit, and safe retry. Verification uses deterministic
barriers across processes, property traces for CAS and distinct-document updates, migration
fixtures, malformed/oversized inputs, warning and hard-limit boundaries, and rate/overload
tests. Browser evidence is retained for changed decision/comment conflict states; no hosted
or provider result is inferred.
