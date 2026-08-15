# OpenCode Artifacts roadmap

Status: Active

Target contract: [`docs/product-spec.md`](product-spec.md)

Last reviewed: 2026-08-15

This roadmap closes measured gaps against the product spec. Phases are ordered by dependency
and risk, not marketing value. A later phase does not begin by weakening an earlier gate.

## Current baseline

Evidence from the repository and clean local host probes:

| Area | Status | Evidence / gap |
|---|---|---|
| Stable OpenCode plugin registration | Shipped | [Local host probe](evidence/opencode-host-verification.md): clean OpenCode processes loaded this checkout and the published 0.14.3 package and returned all four artifact tools |
| Claude reference audit | Verified with auth boundary | [Claude host probe](evidence/claude-code-host-verification.md): current official Artifact references were audited and native 2.1.233 was installed/inspected; claude.ai publishing remains untested because the host is not signed in |
| Markdown/declarative rendering | Shipped | component, Markdown, render, CSP, and browser evidence suites |
| Offline self-contained page | Shipped | conditional inlined runtimes, strict on-disk CSP, 15 MiB final-write cap |
| Local gallery/live preview | Shipped | manifest/gallery tests and `serve` SSE tests |
| Identity and immutable lifecycle | Partial | slug is title-derived; history is opt-in; lock is process-local; writes are not one crash-safe transaction |
| Local comments/decisions/DB | Partial | functional, but read-modify-write storage lacks cross-process CAS and schema migration |
| Public snapshot hosting | Partial | GitHub Pages and public Cloudflare deployment work; capability/visibility is not modeled explicitly |
| Authenticated team sharing | Missing | Cloudflare Access is a manual guide, not verified/configured product behavior; no roles, audience UI, or revocation model |
| Hosted live updates | Missing | already-open hosted pages are not notified of a new head |
| Viewer-scoped MCP connectors | Missing | local fixed-command datasource bridge is not a hosted per-viewer connector broker |
| Governance | Missing | no retention policy, deletion lifecycle, compliance API, or artifact audit log |
| Packaged-host compatibility CI | Missing | unit plugin tests exist; the packed tarball is not loaded into a clean current OpenCode host in CI |

“Shipped” means the current behavior exists; it does not waive any stronger acceptance rule in
the product spec.

## Phase 0 — Make the contract truthful

Goal: one authoritative definition and no inflated parity language.

- [x] Establish `docs/product-spec.md` as the normative target.
- [x] Separate portable artifact behavior from optional service behavior.
- [x] Ground requirements in current official Claude Code and OpenCode docs.
- [x] Install the current OpenCode CLI locally and verify this checkout registers all tools.
- [x] Install the current Claude Code CLI, inspect its local Artifact surface, and record the
  account-authentication boundary separately from verified behavior.
- [ ] Update release/checklist templates so a parity claim names its level and evidence.
- [ ] Add a documentation link checker for official source URLs and internal spec anchors.

Exit gate: README, comparison, component docs, and hosting docs agree on what is shipped,
partial, and missing.

## Phase 1 — Durable artifact identity and transactions

Goal: make local publishing correct under multiple sessions, processes, crashes, and upgrades.

Requirements: `LIFE-01` through `LIFE-07`, `LOCAL-04`, schema portions of section 8.

1. Introduce schema-versioned `ArtifactRecord` and `RevisionRecord` models with opaque
   artifact IDs, stable slugs, immutable revision metadata, and deployment references.
2. Add explicit artifact references to publish/update: ID, path, or supported hosted URL.
   Decouple title changes from identity and reject ambiguous slug guesses.
3. Make history unconditional. Migrate existing manifests by archiving every recoverable head;
   mark irrecoverable legacy entries honestly instead of listing nonexistent revisions.
4. Replace the in-memory publisher queue with an inter-process lock plus atomic staged writes
   and rename. Commit page, revision, manifest, and gallery as one recoverable transaction.
5. Make restore an auditable head-change/new revision rather than a destructive pointer edit.
6. Apply atomic CAS to state, comments, and DB mutations. Add bounded collection/thread limits.
7. Add migration fixtures from every released manifest/state shape, including the historical
   Cloudflare shared-KV namespace, with backup and rollback tests.
8. Add list/read/status/archive operations consistently to CLI and plugin.

Exit gate:

- a multi-process race test proves one winner for the same expected head and no lost manifest
  entries for different artifacts;
- fault injection at every write boundary always recovers a complete old or new transaction;
- all old fixtures either migrate losslessly or produce an explicit repair report.

## Phase 2 — Portable page completeness

Goal: make the offline file cover the official single-page envelope without relying on raw
HTML for ordinary content.

Requirements: `RENDER-01` through `RENDER-08`, `LOCAL-01`.

1. Add a declared asset pipeline for worktree-local images, SVG, and fonts. Resolve under the
   worktree, validate MIME/size, inline as data URIs, and include bytes in the final cap.
2. Reject or deliberately import external assets; never emit a page that the CSP silently
   leaves broken. Add useful alt-text diagnostics.
3. Add component-schema preflight so the agent receives all authoring errors before publish,
   while preserving inline errors for standalone renderer resilience.
4. Add design-system configuration (tokens only) with precedence: prompt > project tokens >
   curated theme. Keep arbitrary project CSS outside Markdown mode.
5. Complete accessibility: semantic chart summaries, table captions, form labels, focus order,
   contrast, reduced motion, keyboard comment/decision flows.
6. Add print/PDF stylesheet and syntax highlighting only if they fit CSP and conditional-bundle
   budgets; neither blocks the asset/accessibility gate.
7. Establish performance budgets for no-chart, one-chart, and multi-runtime pages.

Exit gate: an artifact containing local images, a chart, a table, and interactive controls
works offline; automated WCAG checks plus keyboard/mobile browser QA pass; final bytes remain
within the cap.

## Phase 3 — Native OpenCode lifecycle

Goal: make artifact behavior feel built into OpenCode rather than merely callable.

Requirements: `OC-01` through `OC-06`, `LIFE-05`, `LIFE-06`.

1. Make `opencode plugin opencode-artifacts` the primary documented install, with config-array
   and local development alternatives.
2. Add packed-package host CI:
   - build and `npm pack`;
   - install into a clean OpenCode config/cache;
   - start the official headless server;
   - assert tool IDs and schemas;
   - execute safe read-only tool smoke tests.
3. Test the oldest supported and current stable OpenCode releases. Narrow the peer range to
   evidence. Track V2 beta separately; add an adapter only when its contracts justify it.
4. Replace unstructured success strings with bounded structured results plus model-readable
   summaries when the stable host API supports them.
5. Add a first-class reopen command/keybinding integration if the stable plugin API exposes a
   supported command/TUI hook; retain `latest --open` as the portable fallback.
6. Separate local-write, datasource-execution, public-deploy, and audience-expansion permission
   resources. Verify OpenCode `allow`/`ask`/`deny` behavior and auto mode.
7. Package the skill so OpenCode discovers it natively without manual copying, or provide a
   tested installer that places it in an official skill directory.

Exit gate: a clean machine can install the released tarball using official OpenCode flows,
see the tools and skill, create/update/reopen an artifact, and exercise permission denials
without using repository-only paths.

## Phase 4 — Reliable local collaboration

Goal: complete the decide/comment/revise loop for one local team without pretending it is a
general application backend.

Requirements: `LOCAL-02` through `LOCAL-05`.

1. Version comment anchors against revision/content ranges and report orphaned anchors after
   edits instead of attaching feedback to the wrong text.
2. Record local author labels when OpenCode/user context provides them; otherwise label the
   author as local/unknown rather than inventing identity.
3. Add watch/unwatch/status primitives over server events so an OpenCode session can notice a
   revision or comment without polling unbounded transcripts.
4. Add rate, request, state, and collection quotas with actionable 4xx responses.
5. Give registered datasources a visible manifest, separate permission, fixed argument list,
   provenance, timeout, output cap, cache policy, and cancellation. Keep loopback binding.
6. Add two-client concurrency and reconnect browser tests.

Exit gate: two local browsers and two publishing processes can comment, decide, update, and
reconnect without lost writes, misplaced anchors, or arbitrary command execution.

## Phase 5 — Honest sharing and authenticated hosting

Goal: provide two explicit products: public snapshots and private team artifacts.

Requirements: `HOST-01` through `HOST-10`.

### 5A. Public snapshot adapters

1. Model target capabilities and visibility in config/result metadata.
2. Label GitHub Pages as public-static in every prompt and result.
3. Scan the exact staged tree, show changed audience, and require deploy permission.
4. Add deploy preview/dry-run, deletion behavior, rollback, and stale-asset cleanup.

### 5B. Authenticated reference deployment

1. Choose and document the reference architecture. The expected Cloudflare shape is Access
   for identity, static assets/object storage for revisions, and a strongly consistent store
   (D1 or Durable Objects) for policy and collaboration; KV alone is not the source of truth.
2. Add a setup command that creates or verifies the access application and fails closed if the
   origin remains publicly reachable.
3. Implement artifact author, viewer/editor ACLs, audience changes, revocation, selected
   shared revision, and “follow latest.”
4. Add an identity-aware gallery and artifact header. Never trust spoofable identity headers
   on an unprotected worker route.
5. Push hosted head/comment events through SSE/WebSocket or bounded version polling.
6. Add audit events, retention/deletion, export, and site/artifact namespace isolation.
7. Isolate untrusted artifact code from the authenticated control plane and verify that page
   JavaScript cannot access identity, session, connector, or administration credentials.
8. Run two-user end-to-end tests plus a real deployment smoke test.

Exit gate: a newly deployed team site is unreachable without identity, can grant/revoke two
users, can pin or follow a revision, updates already-open viewers, preserves concurrent
comments, and emits auditable events.

## Phase 6 — Viewer-scoped connectors and governance

Goal: close the largest structural gap with Claude's hosted artifacts without exposing
credentials or turning pages into unrestricted applications.

Requirements: `CONN-01` through `CONN-07`, governance parts of `HOST-07` and `HOST-09`.

1. Define a signed per-revision capability manifest for remote MCP server and tool IDs.
2. Build a hosted broker that authenticates the viewer, records grants, validates arguments,
   enforces quotas/timeouts, and returns sanitized JSON. Credentials stay server-side.
3. Ship read-only tools first with captured-data and “connect X” fallbacks.
4. Prohibit connectors on public artifacts in policy and routing, not only UI.
5. Add cache partitioning by viewer, artifact, revision, connector, and arguments; never leak
   one viewer's response to another.
6. Add side-effecting actions only after per-call confirmation, idempotency, policy controls,
   and audit are independently reviewed.
7. Add organization controls: disable artifacts, disable connectors, disable public sharing,
   role scopes, retention, audit export, and list/retrieve/deletion/export APIs.

Exit gate: two viewers with different connector grants see correctly isolated results; denial
and missing-connection fallbacks work; public URLs cannot reach the broker; action retries do
not duplicate side effects.

## Release levels

Use these labels in release notes and README claims:

| Level | Required phases | Claim allowed |
|---|---|---|
| Local artifact core | 0–3 | Offline pages and native local OpenCode lifecycle |
| Local collaboration | 0–4 | Reliable served comments/decisions/live data on one machine |
| Public snapshots | 0–4 + 5A | Explicit public static sharing |
| Authenticated collaboration | 0–5 | Private team sharing with identity, roles, revisions, and live updates |
| Connector-capable artifacts | 0–6 | Viewer-authorized hosted live data under policy and audit |

No release should say “full parity” without meeting the final definition of complete in the
product spec and rechecking the current official documentation index plus clean local
OpenCode and Claude Code reference installations. Account-backed Claude service tests must
name the plan and policy used and must never become a CI credential requirement.
