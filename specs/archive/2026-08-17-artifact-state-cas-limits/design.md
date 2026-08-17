# Design: Make mutable artifact state atomic and bounded

Required for high-risk changes.

## Context and constraints

Three local mutable-store families are exposed both through loopback HTTP and plugin tools.
Their current JSON shapes lack schema versions and revisions. Correctness must hold across
server/plugin processes, not merely request handlers in one process. Limits must apply after
JSON encoding and before writes, conflict responses must be useful but bounded, and state must
follow opaque artifact identity after migration. The portable on-disk page remains network
independent and public-static targets cannot inherit local mutable-state claims.

## Chosen design

Store schema 2 uses an envelope containing integer `schemaVersion`, opaque artifact ID, store
kind/key, monotonic revision, SHA-256 content hash, normalized payload, and updated timestamp.
Every mutation supplies an expected revision/hash or create-only precondition. The store is
re-read inside the fenced lifecycle transaction; mismatch returns the current revision/hash
and a bounded current payload sufficient to merge. Mutations to distinct document IDs are
applied to the latest collection inside the lock, so one process cannot replace another's
unrelated document. A repeated operation ID returns its prior result.

Default limits are: decision document 64 KiB, 256 answers, 256-byte keys, and 4 KiB values;
comment store 256 KiB, 200 threads, 128-byte IDs, 8 KiB quotes, and 16 KiB comment text;
database document 256 KiB, collection 1,000 documents and 16 MiB encoded; and 120 mutations per
artifact/store per rolling minute with a warning at 80 percent. Operator configuration may
lower limits or raise them only up to fixed ceilings of four times each default (1,000
mutations/minute is the absolute rate ceiling). Reads, writes, response previews, lock wait,
and retry count remain independently bounded. Limit accounting uses final UTF-8 JSON bytes.

HTTP uses ETag/`If-Match` and `If-None-Match`; structured bodies also carry an operation ID.
The served bridge tracks revisions and shows a reload/merge state on conflict. Plugin
operations expose equivalent expected revision and bounded structured results after the
lifecycle-surfaces packet approves their public shape. Legacy local JSON migrates under
backup; historical Cloudflare records can be exported/mapped but remain unverified and are
never labeled strongly consistent.

## Alternatives

Rejected: retaining last-write-wins replacement, because it loses concurrent work. Rejected:
process-local mutexes, because plugin and server processes are independent. Rejected: merging
arbitrary JSON automatically, because conflicts are domain-dependent and can silently corrupt
intent. Rejected: unbounded live payloads on conflict, because they create privacy and
resource risks. Rejected: claiming Cloudflare KV satisfies CAS, because eventual consistency
does not meet the contract.

## Trust, privacy, and failure boundaries

Request bodies, document values, IDs, expected tokens, envelopes, and legacy files are
untrusted. Names and artifact identity are validated before filesystem access; payload shape,
depth, scalar lengths, encoded bytes, counts, and rate are checked before locking where safe
and again before commit. Diagnostics redact content by default and cap merge previews.
Malformed, future-schema, stale, quota, timeout, replay-conflict, and corrupt-store cases fail
without mutation. Local rate keys do not contain viewer identity or page content.

## Migration, rollout, and rollback

Introduce schema-2 readers, validators, and dry-run migration before enabling writes. Migrate
one store under the lifecycle transaction, verify bytes/hash/identity, then select it; retain
the exact old file until rollback expiry is explicitly recorded. Update HTTP, bridge, and
plugin paths together so no compatibility surface bypasses CAS. On rollback, disable writes,
recover outstanding transactions, verify and select the backup, and report revisions that
cannot be represented. Hosted KV remains a separate unavailable migration target until its
later architecture is approved.

## Formal-method decision

- Decision: CAS state-machine/property model with exhaustive bounded interleavings.
- Property and rationale: one expected revision commits at most once; stale mutations never
  write; distinct-document concurrent mutations are both retained; revisions increase by one;
  migration preserves payload; limits are monotonic and enforced before commit; and retry by
  operation ID does not duplicate effects.
- Model/evidence path: add dependency-free traces under `test/model/`, independent-process
  worker tests, and local browser/limit evidence under `docs/evidence/lifecycle/`.
