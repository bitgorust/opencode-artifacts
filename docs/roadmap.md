# OpenCode Artifacts roadmap

Status: Active

Target contract: [`docs/product-spec.md`](product-spec.md)

Last reviewed: 2026-08-15

This roadmap closes measured gaps against the product spec. Phases are ordered by dependency
and risk, not marketing value. A later phase does not begin by weakening an earlier gate.
Every requirement is mapped in
[`docs/requirements-traceability.md`](requirements-traceability.md); phase ranges below name
the primary implementation work, while cross-cutting acceptance requirements apply wherever
their condition exists. Standard and high-risk work is delivered through the approved
[spec-anchored change workflow](../specs/README.md), not directly from roadmap prose.

## Planning model

Effort is an order-of-magnitude range for one experienced maintainer after dependencies are
available: **S** (days), **M** (roughly 1–2 weeks), **L** (roughly 2–6 weeks), and **XL**
(multiple months or separately staffed workstreams). It is not a delivery promise. Dates are
assigned only after staffing, provider access, and external review availability are known.

| Phase | Outcome | Accountable role | Effort | Depends on | Primary external constraint |
|---|---|---|---|---|---|
| 0 | Truthful, measurable product contract | Product/release maintainer | M | None | representative users and policy review |
| 1 | Durable identity and transactions | Core storage maintainer | L | Phase 0 contract | cross-platform locking semantics |
| 2 | Complete, competitive portable pages | Renderer/design maintainer | XL | Phase 0; Phase 1 identity format | authenticated Claude baseline and blinded reviewers |
| 3 | Native packaged OpenCode lifecycle | OpenCode/release maintainer | M | Phase 1 schemas | supported OpenCode host versions/API stability |
| 4 | Reliable local collaboration | Local runtime maintainer | L | Phases 1 and 3 | multi-client/browser test environments |
| 5A | Honest public snapshots | Hosting maintainer | M | Phases 0–3 | provider credentials for smoke deploys |
| 5B | Authenticated collaboration | Hosting maintainer | XL | Phases 1, 3, 4, and 5A | identity/provider architecture and two-user test accounts |
| 6 | Viewer-scoped connectors | Connector maintainer | XL | Phase 5B | provider grants, MCP policy, abuse/cost controls |

Critical path: **0 → 1 → 3 → 4 → 5B → 6**. Phase 2 may run beside phases 1–4 after its
fixture contract is stable; its authenticated comparison remains an external release blocker
for an equal-or-better claim. Phase 5A may run beside Phase 4 after lifecycle metadata and
deployment capability labels stabilize.

## Current baseline

Evidence from the repository and clean local host probes:

| Area | Status | Evidence / gap |
|---|---|---|
| Stable OpenCode plugin registration | Shipped | [Local host probe](evidence/opencode-host-verification.md): clean OpenCode processes loaded this checkout and the published 0.14.3 package and returned all four artifact tools |
| Claude reference audit | Verified with auth boundary | [Claude host probe](evidence/claude-code-host-verification.md): current official Artifact references were audited and native 2.1.233 was installed/inspected; claude.ai publishing remains untested because the host is not signed in |
| Markdown/declarative rendering | Shipped | component, Markdown, render, CSP, and browser evidence suites |
| Equal-or-better page quality | Unverified | pattern screenshots exist, but there is no authenticated same-input Claude corpus or blinded benchmark; the current dashboard also exposes fixed-size chart/dead-space composition gaps |
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
| Product outcomes and usability evidence | Missing | target users and measurable journeys are now specified, but no journey study has been run |
| Privacy/operations/performance governance | Missing | requirements and owners exist; inventories, runbooks, harnesses, SLO evidence, and cost models do not |
| Supply-chain release evidence | Partial | lockfile and pack inspection exist; SBOM, provenance, license/vulnerability evidence, and support policy do not |

“Shipped” means the current behavior exists; it does not waive any stronger acceptance rule in
the product spec.

## Phase 0 — Make the contract truthful

Goal: one authoritative, measurable definition and no inflated capability language.

Requirements: `OUT-01` through `OUT-06`, `UX-01` through `UX-08` at contract level,
`PRIV-01` through `PRIV-07` at policy level, `SEC-01`, `SEC-10`, `COMPAT-01`, `DIST-03`
through `DIST-07`, `QUAL-01`, `QUAL-08`.

Owner: Product/release maintainer. Effort: **M**. Dependencies: none. Main risk: producing
paper policy without executable evidence. Stop/re-scope: do not start a release claim whose
users, support envelope, data handling, or acceptance evidence cannot be named.

- [x] Establish `docs/product-spec.md` as the normative target.
- [x] Separate portable artifact behavior from optional service behavior.
- [x] Ground requirements in current official Claude Code and OpenCode docs.
- [x] Install the current OpenCode CLI locally and verify this checkout registers all tools.
- [x] Install the current Claude Code CLI, inspect its local Artifact surface, and record the
  account-authentication boundary separately from verified behavior.
- [x] Add a release-evidence template that names the claimed level and resolves every
  requirement to evidence, failure, or reasoned non-applicability.
- [ ] Add a documentation link checker for official source URLs and internal spec anchors.
- [x] Define a MECE requirement taxonomy and map every requirement to a phase, owner role,
  evidence contract, release applicability, and status.
- [x] Adopt a risk-scaled spec-anchored workflow that separates target intent, current shipped
  behavior, proposed deltas, and validation/verification evidence.
- [ ] Check in the create/revise/review/share journey corpus and run the first OUT-02/OUT-03
  study with consented representative users.
- [ ] Publish the supported-platform matrix, threat model, data inventory, telemetry stance,
  retention/deletion/public-abuse policies, vulnerability contact/response policy, and
  supported-version/deprecation policy.

Exit gate: README, comparison, component docs, hosting docs, traceability, and release
template agree on what is shipped, partial, missing, or not applicable; every normative ID
has one owner and evidence path; the first-use and comprehension baselines are recorded.

## Phase 1 — Durable artifact identity and transactions

Goal: make local publishing correct under multiple sessions, processes, crashes, and upgrades.

Requirements: `LIFE-01` through `LIFE-07`, `LOCAL-04`, and the applicable `COMPAT`
requirements.

Cross-cutting requirements: `UX-01`, `UX-02`, `UX-04`, `UX-06`, `SEC-02`, `SEC-07`,
`OPS-03` through `OPS-05`, `OPS-07`, `COMPAT-03` through `COMPAT-05`, `COMPAT-07`,
`QUAL-02`, `QUAL-06`.

Owner: Core storage maintainer. Effort: **L**. Dependencies: Phase 0 schema and recovery
contract. Main risk: irreversible migration or platform-specific lock behavior. Stop/re-scope:
do not enable a new schema by default until backup, rollback, and old/new crash recovery pass
on every supported write platform.

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

Requirements: `RENDER-01` through `RENDER-12`, `LOCAL-01`.

Cross-cutting requirements: `OUT-02`, `OUT-03`, `UX-02`, `UX-05`, `UX-07`, `SEC-02`
through `SEC-04`, `PERF-01` through `PERF-03`, `PERF-05`, `COMPAT-02`, `COMPAT-08`,
`QUAL-02`, `QUAL-04`, `QUAL-07`.

Owner: Renderer/design maintainer. Effort: **XL**. Dependencies: Phase 0 corpus and stable
Phase 1 identity/metadata format. Main risk: optimizing curated fixtures while ordinary pages
regress. Stop/re-scope: without authorized same-input Claude runs, ship renderer improvements
but retain the explicit “unverified” quality claim; raw HTML cannot substitute for failure of
the declarative core corpus.

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
8. Check in the eight permission-safe fixtures defined by
   [`docs/page-quality-benchmark.md`](page-quality-benchmark.md), including prompts, source
   bundles, required facts, reader decisions, and interaction scripts.
9. Replace fixed-size visual islands with responsive composition primitives: full-bleed and
   split layouts, proportional chart/diagram sizing, media/mockup frames, annotations, and
   intentional dense/quiet variants. Remove unexplained dead space at desktop and clipping at
   mobile widths.
10. Expand the renderer's visual grammar without making every page look alike: task-aware hero
    treatments, type scales, card emphasis, section rhythm, comparison layouts, code/diff
    framing, and chart-plus-narrative compositions. Keep tokens and components bounded and
    CSP-safe.
11. Obtain authorized current Claude Code Artifact outputs for every fixture, retain all
    required generations rather than cherry-picking, and record version/model/plan metadata.
12. Run the blinded rubric with at least three reviewers, publish the full result distribution,
    fix losing archetypes, and repeat until every absolute and comparative threshold passes.

Exit gate: an artifact containing local images, a chart, a table, and interactive controls
works offline; automated WCAG checks plus keyboard/mobile browser QA pass; final bytes remain
within the cap. The full core corpus has no hard-gate failures, at least 80% of same-input
pairs are rated OpenCode equivalent or better, no task family loses a reviewer majority, and
OpenCode meets or exceeds Claude's median in every rubric dimension while scoring at least
4/5 absolutely.

## Phase 3 — Native OpenCode lifecycle

Goal: make artifact behavior feel built into OpenCode rather than merely callable.

Requirements: `OC-01` through `OC-06`, `LIFE-05`, `LIFE-06`.

Cross-cutting requirements: `OUT-02`, `UX-01` through `UX-03`, `UX-08`, `SEC-05`,
`COMPAT-01`, `COMPAT-05`, `COMPAT-06`, `COMPAT-08`, `DIST-01` through `DIST-06`,
`QUAL-03`, `QUAL-08`.

Owner: OpenCode/release maintainer. Effort: **M**. Dependencies: Phase 1 schemas and official
host releases in the support matrix. Main risk: beta API churn or workspace-only assumptions.
Stop/re-scope: keep the stable adapter and narrow unsupported peer ranges instead of shipping
an unproved beta migration.

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

Cross-cutting requirements: `UX-01` through `UX-05`, `UX-08`, `SEC-02`, `SEC-07` through
`SEC-09`, `PRIV-01` through `PRIV-03`, `PRIV-05`, `PRIV-06`, `OPS-02` through `OPS-04`,
`OPS-07`, `OPS-08`, `PERF-01`, `PERF-04` through `PERF-06`, `QUAL-04`, `QUAL-06`.

Owner: Local runtime maintainer. Effort: **L**. Dependencies: Phases 1 and 3. Main risk:
growing the loopback helper into an unsafe general backend. Stop/re-scope: reject capabilities
that require viewer-supplied commands, remote exposure, or unbounded durable application state.

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

Cross-cutting requirements: all applicable `UX`, `SEC`, `PRIV`, `OPS`, `PERF`, `COMPAT`,
`DIST`, and `QUAL` requirements.

Owner: Hosting maintainer; identity, security, privacy, and operations roles provide required
reviews for 5B. Effort: **M** for 5A and **XL** for 5B. Dependencies: 5A requires Phases 0–3;
5B requires Phases 1, 3, 4, and 5A. Main risks: a publicly bypassable “private” origin,
inconsistent mutable state,
provider lock-in, data-loss recovery, and unbounded operating cost. Stop/re-scope: public
snapshots remain separately supported; authenticated claims remain unavailable until the
origin fails closed, two-user isolation passes, and restore/rollback evidence exists.

### 5A. Public snapshot adapters

1. Model target capabilities and visibility in config/result metadata.
2. Label GitHub Pages as public-static in every prompt and result.
3. Scan the exact staged tree, show changed audience, and require deploy permission.
4. Add deploy preview/dry-run, deletion behavior, rollback, and stale-asset cleanup.
5. Publish target-specific privacy, retention, abuse/takedown, cost, and operator-boundary
   documentation; verify teardown does not delete unrelated sites or local source artifacts.

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
8. Add health/metrics/alerts, quotas, backup/restore, staged migration/rollback, incident
   runbooks, supported-capacity tests, SLO evidence, and an idle/nominal/limit cost model.
9. Run two-user end-to-end tests plus a real deployment, failover, restore, and origin-bypass
   smoke test.

Exit gate: a newly deployed team site is unreachable without identity, can grant/revoke two
users, can pin or follow a revision, updates already-open viewers, preserves concurrent
comments, and emits auditable events.

## Phase 6 — Viewer-scoped connectors and governance

Goal: close the largest structural gap with Claude's hosted artifacts without exposing
credentials or turning pages into unrestricted applications.

Requirements: `CONN-01` through `CONN-07`, governance parts of `HOST-07` and `HOST-09`.

Cross-cutting requirements: `UX-02`, `UX-03`, `UX-05`, `UX-08`, `SEC-05` through `SEC-09`,
`PRIV-01` through `PRIV-06`, `OPS-02`, `OPS-04`, `OPS-06` through `OPS-08`, `PERF-04`
through `PERF-07`, `QUAL-05`, `QUAL-06`, `QUAL-08`.

Owner: Connector maintainer; the security role must approve its trust boundary. Effort:
**XL**. Dependencies: Phase 5B identity,
policy, audit, strong state, and operations. Main risks: credential exposure, cross-viewer
cache leaks, SSRF, repeated side effects, provider cost, and misleading live-data fallbacks.
Stop/re-scope: ship captured-data and then read-only connectors first; side-effecting actions
remain unavailable until independently reviewed idempotency, confirmation, policy, audit, and
cost limits all pass.

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
8. Add connector-specific saturation alerts, provider outage behavior, privacy inventory,
   response-cache retention, cost quotas, and incident/key-rotation runbooks.

Exit gate: two viewers with different connector grants see correctly isolated results; denial
and missing-connection fallbacks work; public URLs cannot reach the broker; action retries do
not duplicate side effects.

## Cross-phase decision register

A decision is resolved by a dated ADR or policy document containing alternatives, evidence,
consequences, owner, and review trigger. “Use the expected shape” is not a decision.

| ID | Decision and deadline | Owner role | Blocks | Current state |
|---|---|---|---|---|
| `D-01` | Supported OpenCode/Node/OS/browser matrix before Phase 1 migration fixtures and Phase 3 CI | Compatibility maintainer | Phases 1, 3 | Open |
| `D-02` | Authorized Claude benchmark account, model/settings protocol, artifact retention permission, and reviewer recruitment before Phase 2 comparison | Product/design maintainer | Equal-or-better claim | Blocked on account and reviewers |
| `D-03` | Authenticated reference architecture: identity proxy, unreachable origin, revision store, strongly consistent mutable store, event delivery, backups, and regional availability before Phase 5B implementation | Hosting/identity maintainer | Phase 5B | Open |
| `D-04` | Hosted operator/controller roles, data regions, retention defaults, deletion/backup expiry, abuse/takedown, and support/SLO policy before Phase 5B public preview | Privacy/operations maintainer | Phase 5B release | Open |
| `D-05` | Connector provider/grant model, allowed protocol surface, SSRF boundary, cache policy, quotas, billing guardrails, and action eligibility before Phase 6 | Connector/security maintainer | Phase 6 | Open |
| `D-06` | Package provenance/signing mechanism, SBOM format, vulnerability/license policy, and supported-version window before the next production-readiness claim | Release maintainer | Release gate | Open |

## Risk register

Owners review this table at each phase gate. A triggered risk becomes tracked implementation
work or an explicit scope reduction; it cannot be accepted by omitting its evidence.

| Risk | Likelihood / impact | Trigger | Mitigation / contingency | Owner role |
|---|---|---|---|---|
| Lifecycle migration loses or invents history | Medium / Critical | fixture, fault, or user upgrade cannot reproduce the old head | backups, dry-run repair report, staged schema enablement, rollback; do not default-enable | Core storage maintainer |
| Renderer overfits benchmark fixtures | High / High | held-out or ordinary examples regress while corpus score rises | held-out pages, all-run reporting, renderer and end-to-end tracks, per-archetype gates | Renderer/design maintainer |
| Claude comparison cannot be legally or operationally retained | Medium / Medium | account policy blocks capture or review | retain prompts/scores where permitted, private review evidence, keep parity claim unverified | Product maintainer |
| “Private” hosted origin is publicly bypassable | Medium / Critical | direct origin accepts an unauthenticated request | fail-closed setup verification, separate content/control planes, no authenticated claim | Hosting/identity maintainer |
| Tenant/viewer data crosses a namespace or cache | Medium / Critical | isolation or replay test reads another authority's state | strong composite keys, authorization on every read, purge/rotate, incident playbook | Security maintainer |
| Provider outage or migration corrupts mutable state | Medium / Critical | restore drill misses RPO/RTO or migration cannot roll back | transactional store, verified backups, staged rollout, last-known-safe reads | Operations maintainer |
| Connector causes credential leak, SSRF, or duplicate action | Medium / Critical | fuzz/retry test reaches undeclared target or repeats effect | broker allowlist, egress policy, sanitized results, idempotency, read-only fallback | Connector/security maintainer |
| Hosted or connector costs grow without bound | Medium / High | forecast or alert crosses documented budget | hard quotas, per-site limits, cost dashboards, degraded mode, feature disable switch | Operations maintainer |
| Platform/API churn breaks clean installation | High / High | current or oldest-supported packed-host job fails | explicit matrix, adapter boundary, narrow claims, tested deprecation/migration | Compatibility maintainer |
| Supply-chain compromise reaches a release | Low / Critical | provenance, vulnerability, or integrity verification fails | pin/review, SBOM/attestation, rotation/revocation playbook, block release | Release/security maintainer |

## Recurring release gate — prove and support the claimed level

Requirements: `OUT-04` through `OUT-06`, all applicable `UX`, `SEC`, `PRIV`, `OPS`, `PERF`,
`COMPAT`, and `QUAL` requirements, plus `DIST-01` through `DIST-07`.

Owner: Release maintainer, with sign-off from each accountable role represented by the
claimed level. Effort: **S–M per release** after automation. Dependencies: the selected phase
exit gate and all external decisions applying to the claim. Main risk: releasing because code
exists while operational, privacy, migration, or evidence obligations remain open.
Stop/re-scope: downgrade the release-level claim, disable the unproved capability, or delay;
never convert a failed/missing requirement to not-applicable merely to pass the gate.

The gate MUST:

1. resolve every applicable requirement to dated evidence and pass/fail/not-applicable;
2. build and inspect the exact package, emit SBOM/provenance, and run the supported clean-host
   matrix plus dependency/license/vulnerability policy;
3. run upgrade/rollback and relevant browser, security, performance, load, backup/restore, and
   real-provider smoke suites;
4. compare README, install, capability, privacy, support, migration, and release-note claims
   to the traceability matrix;
5. record known failures, risk acceptance, rollout/rollback owner, support window, and post-
   release verification; and
6. retain or withdraw comparative page-quality claims according to the current benchmark.

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
