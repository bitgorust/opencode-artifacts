# `/goal` execution runbook

Status: Active delivery runbook

Last reviewed: 2026-08-15

This runbook partitions the target in [`docs/product-spec.md`](product-spec.md) into durable,
verifiable Codex goals. The [roadmap](roadmap.md) remains the canonical owner of phase work,
dependencies, risks, and exit gates. The
[traceability matrix](requirements-traceability.md) owns requirement-to-evidence coverage,
and the [spec-anchored workflow](../specs/README.md) owns change packets. This document owns
only goal boundaries, order, checkpoints, and handoffs.

## Canonical precedence

This runbook is a router, never a substitute specification. If any summary, prompt, packet
name, or stopping-condition phrase here differs from a canonical owner, use the owner below
and correct this runbook in the same change:

| Fact | Canonical owner |
|---|---|
| target outcome and normative behavior | [`docs/product-spec.md`](product-spec.md) |
| engineering constraints | [`docs/engineering-principles.md`](engineering-principles.md) |
| phase work, dependency, risk, and exit gate | [`docs/roadmap.md`](roadmap.md) |
| requirement mapping and status | [`docs/requirements-traceability.md`](requirements-traceability.md) |
| comparative quality method and threshold | [`docs/page-quality-benchmark.md`](page-quality-benchmark.md) |
| behavior known to ship | [`specs/current/`](../specs/current/) |
| an approved change and its evidence | the applicable packet under `specs/changes/` or `specs/archive/` |

Packet names below define proposed review boundaries only. Their proposals import the current
canonical requirement IDs and scenarios; the shorthand descriptions do not create acceptance
criteria.

The partition follows [official OpenAI `/goal` guidance](https://learn.chatgpt.com/use-cases/follow-goals):
one durable objective, one verifiable stopping condition, named inputs, a validation loop,
and work smaller than an open-ended backlog. Phases 0–3 therefore form the first
**local artifact core program**, not one oversized goal. They run as Goals 1–5 before
collaboration, hosting, or connectors can be claimed.

## End-to-end sequence

Run one goal at a time. A goal may prepare later work only where the roadmap explicitly
allows parallelism; it cannot claim a later level before the accumulated earlier gate passes.

| Goal | Durable objective | Roadmap scope | Verifiable stopping condition |
|---|---|---|---|
| 1 | Truthful, executable public-preview contract | Phase 0 | Phase 0 public-preview gate passes with real hard-gate evidence and missing certification inputs visible |
| 2 | Durable artifact lifecycle | Phase 1 | transaction, recovery, migration, and lifecycle gates pass |
| 3 | Portable rendering completeness | Phase 2 correctness track | offline asset, accessibility, security, and performance gates pass |
| 4 | Native packaged OpenCode lifecycle | Phase 3 | clean packed installs and permission/lifecycle host tests pass |
| 5 | Competitive page quality and local-core certification | Phase 2 quality track + recurring gate | benchmark and local artifact core release decision pass |
| 6 | Reliable local collaboration | Phase 4 + recurring gate | two-client/two-publisher loop and accumulated release gate pass |
| 7 | Honest public snapshots | Phase 5A + recurring gate | public deploy/rollback/delete gates and release decision pass |
| 8 | Fail-closed authenticated hosting foundation | Phase 5B foundation | identity, storage, isolation, and recovery substrate pass |
| 9 | Authenticated collaboration | remaining Phase 5B + recurring gate | two-user private collaboration and release decision pass |
| 10 | Connector-capable artifacts and complete-target certification | Phase 6 + recurring gate | Phase 6 and the definition of complete pass |

Goal 4 may run after Goal 2 while Goal 3 or 5 awaits external visual-review inputs, but Goal 5
cannot certify local artifact core until Goals 1–4 pass. Goal 7 engineering may be prepared
beside Goal 6 after its dependencies stabilize, but the public-snapshot release level still
accumulates local-collaboration requirements.

## Inputs Codex cannot invent

Confirm each row before starting the first dependent goal. Codex may create a protocol,
harness, fixture, or diagnostic; it must not fabricate a participant, account, permission,
policy approval, provider result, or manual QA outcome.

| Needed by | Human/external input | If unavailable |
|---|---|---|
| Goal 1 | npm package-owner authentication and exact public-preview provider evidence | retain the provider gate as failed/unverified; do not publish preview |
| Goal 2 | supported OS filesystems for lock/migration/fault tests | macOS and Windows native/WSL cells are optional for Goal 2 completion; keep them unverified and do not default-enable the schema there |
| Goal 3 | supported desktop/mobile browsers, keyboard and screen-reader QA | retain the affected compatibility/accessibility failure |
| Goal 4 | oldest-supported and current stable OpenCode hosts; release-policy decisions | narrow the support claim or pause certification |
| Goal 5 | representative-user evidence required by `OUT-02`/`OUT-03`, supported-platform access, authorized current Claude Artifact runs, retention permission, and benchmark reviewers | public preview may continue; keep support, equal-or-better, and local-core certification unverified |
| Goal 6 | independent clients and secondary reviewers required by `OUT-03` and the Phase 4 gate | do not certify local collaboration |
| Goal 7 | GitHub Pages and Cloudflare test sites/credentials; public abuse/privacy policy owners | fake tests may pass, but public certification pauses |
| Goals 8–9 | identity/domain/provider architecture, two users, region/retention/SLO decisions, backup target | authenticated support remains unavailable |
| Goal 10 | connector grants/provider, two viewers, MCP/egress policy, quota/cost owner | connector-capable and complete-target claims remain unavailable |

## Common run loop for every goal

### 1. Establish a clean checkpoint

- Confirm the prior goal is merged or present on the selected base branch.
- Require a clean working tree and fetch the remote before branching.
- Use `agent/goal-<number>-<short-name>` and a draft PR by default. Direct pushes to `main`,
  releases, real deployments, audience changes, deletions, and paid-provider actions require
  explicit authority in the goal request.
- Record the starting commit in the first progress update.

### 2. Load the contract

Read, in order:

1. `AGENTS.md` and `docs/engineering-principles.md`;
2. the applicable roadmap phase and cross-phase decisions/risks;
3. applicable product requirements and traceability rows;
4. `specs/current/` and retained evidence for the affected domain; and
5. relevant prior packets, issues, CI failures, or provider reports.

Audit current code before trusting a status label. Mark already-satisfied work only with
current evidence.

### 3. Resolve entry decisions

Resolve every blocking decision-register item with an ADR or policy record. Check that needed
accounts, reviewers, platforms, and credentials exist. If an input is missing, continue only
with independent work that cannot prejudice the decision; never silently substitute a
provider or reduce the acceptance gate.

### 4. Propose bounded change packets

Use each goal's suggested packet decomposition as a starting point. Split further when work
mixes unrelated risks or approvers. For every standard/high-risk packet:

```text
npm run spec -- new <id> --lane <standard|high-risk> --title "<outcome>"
npm run spec -- validate <id> --phase proposal
```

Codex drafts proposal, complete deltas, normal/failure/boundary scenarios, design where
required, tasks, validation, rollback, and formal-method decision. It then pauses that packet
for human approval. The maintainer reviews scope and records `approval.by`, `approval.at`, and
an approved status in `change.json`; `/goal resume` continues the run.

### 5. Implement one approved packet at a time

- Work in dependency order and keep the last verified checkpoint recoverable.
- Add deterministic tests with behavior; use model/property/fault tests at high-risk state
  boundaries.
- Run the smallest relevant suite after each coherent edit and investigate failures.
- Never route around permission, provider, human-review, or destructive-action checkpoints
  because the goal is long-running.

### 6. Verify and archive each packet

Record both validation (the outcome is useful/right) and verification (the implementation
matches the contract). Update affected `specs/current/*.spec.md`, resolve tasks, and link exact
tests, models, or retained manual reports.

```text
npm run spec -- validate <id> --phase implementation
npm run spec -- validate <id> --phase archive
npm run spec -- archive <id>
```

Do not archive a failed delta as shipped current behavior. Amend and reapprove it, or use the
documented withdrawal command before current truth changes. Withdrawal preserves rationale
but never satisfies the goal.

### 7. Run the goal-specific gate

Run every automated and manual item named by the goal and roadmap exit gate. At minimum:

```text
npm test
npm run build
npm run check
npm pack --dry-run
git diff --check
```

Certified user-visible work also requires real browser/accessibility evidence; adapters need
fake-runner and authorized real-provider smoke evidence. Public preview may retain those
certification inputs as visibly incomplete but still requires its exact technical hard gates.
Every distribution needs a completed copy of `docs/release-evidence-template.md` under
`docs/evidence/releases/`.

### 8. Reconcile truth

- Update requirement statuses, evidence links, roadmap checkboxes, decisions/risks,
  compatibility claims, and README capability language from the same evidence.
- Record failures, exclusions, unsupported platforms, and reduced claims beside successes.
- Re-run structural checks after documentation changes.

### 9. Deliver and hand off

- Review the full diff and secret scan, make intentional Conventional Commits, push the goal
  branch, and open/update its draft PR when authorized.
- Require CI and external checks to pass on the exact commit.
- Report commit, branch/PR, archived packets, evidence/status changes, validation, unresolved
  risks, and inputs required by the next goal.
- Mark a goal complete only when its stopping condition passes. Use `/goal` for status and
  `/goal pause`/`/goal resume` around human or external checkpoints; do not start the next goal
  while the current one is merely “mostly done.”

## Goal 1 — Truthful, executable public-preview contract

### Copy-ready objective

```text
/goal Execute Goal 1 in docs/goal-runbook.md: finish roadmap Phase 0 as a truthful,
executable public-preview contract. Follow the common run loop and spec-anchored workflow,
retain exact policy, security, package, provider, and release evidence, and stop only when the
canonical Phase 0 public-preview gate linked below passes. Keep uncollected representative-
user and full target-platform evidence visibly incomplete; do not fabricate participants,
approvals, platform results, or evidence. Deliver on an agent/goal-1-contract branch with a
draft PR unless I authorize another delivery path.
```

### Packets, work, and gate

- `contract-link-integrity` — standard; official-source and internal-anchor validation.
- `journey-corpus-and-baseline` — standard; fixtures, consent protocol, strict diagnostic
  harness, and honest incomplete OUT-02/OUT-03 certification status.
- `platform-security-privacy-policy` — high-risk; D-01/D-06, support matrix, threat model, data
  inventory, telemetry, retention/deletion/abuse, vulnerability, support, and release policies.
- `public-preview-release-gate` — high-risk; non-certified preview state machine, exact hard
  gates, claim consistency, provider verification, and first preview decision.

Canonical scope and stopping condition: [Roadmap Phase 0](roadmap.md#phase-0--make-the-contract-truthful)
and its linked product/traceability records. The goal passes when the unsupported public-
preview transition and exact pre/post-publish gates pass with certification evidence still
truthfully incomplete; it does not certify local artifact core. Hand off schema/recovery
constraints to Goal 2 and the fixture, participant, platform, and comparative protocols to
Goals 3 and 5.

## Goal 2 — Durable artifact lifecycle

### Copy-ready objective

```text
/goal Execute Goal 2 in docs/goal-runbook.md: implement and verify roadmap Phase 1 so artifact
identity, revisions, publication, restore, state, and migration are correct across concurrent
processes and crashes. Preserve compatibility and rollback. Stop only when the canonical
Phase 1 technical gate linked below passes on the observed Node 24 Ubuntu/ext4 cell. Missing
macOS and Windows native/WSL filesystem observations are optional for this goal only and must
remain unverified without default schema enablement or inherited support claims. Deliver on an
agent/goal-2-lifecycle branch with a draft PR unless I authorize otherwise.
```

### Packets, work, and gate

- `artifact-identity-schema-migration` — high-risk; identity, immutable history, metadata,
  legacy fixtures, backup, repair, and rollback.
- `artifact-publication-transaction` — high-risk; inter-process serialization, atomic
  multi-file commit, fault injection, recovery, and a formal transaction model.
- `artifact-state-cas-limits` — high-risk; atomic comments/decisions/database state and bounds.
- `artifact-lifecycle-surfaces` — high-risk public CLI/plugin changes; references, restore,
  list/read/status/archive, stale merge payloads, and SemVer.

Canonical scope and stopping condition: [Roadmap Phase 1](roadmap.md#phase-1--durable-artifact-identity-and-transactions)
and the linked lifecycle/cross-cutting requirements. Freeze the verified identity, metadata,
and export contracts for Goals 3, 4, and 6.

## Goal 3 — Portable rendering completeness

### Copy-ready objective

```text
/goal Execute Goal 3 in docs/goal-runbook.md: complete the correctness, offline portability,
asset, declarative-authoring, accessibility, and performance portions of roadmap Phase 2.
Preserve the governing security and resource constraints. Stop only when the canonical Phase
2 correctness gates linked below pass; leave comparative certification to Goal 5. Deliver on
an agent/goal-3-renderer branch with a draft PR unless I authorize otherwise.
```

### Packets, work, and gate

- `portable-asset-pipeline` — high-risk; contained paths, MIME/size validation, embedding,
  missing/external behavior, and final-byte accounting.
- `declarative-authoring-preflight` — standard; complete schema diagnostics and fallback errors.
- `renderer-design-tokens` — standard; prompt/project/default precedence without executable code.
- `renderer-accessibility-i18n` — standard; semantics, keyboard, zoom, motion, Unicode, time
  zones, locale/RTL, manual assistive technology, and justified print/PDF behavior.
- `renderer-performance-budgets` — standard; reproducible fixture harness and percentiles.

Canonical scope and stopping condition: the correctness portion of
[Roadmap Phase 2](roadmap.md#phase-2--portable-page-completeness),
[authoring/rendering requirements](product-spec.md#65-authoring-and-rendering), and linked
cross-cutting gates. CSP/dependency changes retain their approval boundary. Hand stable
fixtures and responsive primitives to Goal 5.

## Goal 4 — Native packaged OpenCode lifecycle

### Copy-ready objective

```text
/goal Execute Goal 4 in docs/goal-runbook.md: complete roadmap Phase 3 against the stable
OpenCode plugin contract and exact packed npm bytes. Keep beta adapters separate. Stop only
when the canonical Phase 3 gate linked below passes on the declared host matrix. Deliver on an
agent/goal-4-opencode branch with a draft PR unless I authorize otherwise.
```

### Packets, work, and gate

- `packed-opencode-host-matrix` — standard; pack/install/discovery/smoke CI and peer evidence.
- `opencode-permission-contracts` — high-risk; distinct local write, datasource, deploy, and
  audience permissions plus allow/ask/deny behavior.
- `opencode-lifecycle-results` — standard with public-API approval; bounded structured results,
  reopen integration/fallback, and lifecycle consistency.
- `opencode-skill-distribution` — standard; official discovery or tested installer.

Canonical scope and stopping condition: [Roadmap Phase 3](roadmap.md#phase-3--native-opencode-lifecycle)
and its decision-register dependencies. Test the tarball, not just the worktree. Hand the
verified outputs of Goals 1–4 to Goal 5.

## Goal 5 — Competitive page quality and local-core certification

### Copy-ready objective

```text
/goal Execute Goal 5 in docs/goal-runbook.md: finish the comparative-quality track of roadmap
Phase 2 and certify Local artifact core across Phases 0–3. Follow the benchmark without
cherry-picking. Stop only when the canonical benchmark, accumulated requirements, and release
gate linked below pass with dated evidence. If reference runs or reviewers are unavailable,
retain the blocker. Deliver on an agent/goal-5-local-core branch with a draft PR.
```

### Packets, work, and gate

- `page-quality-corpus` — standard; eight permission-safe bundles, prompts, facts, decisions,
  interaction scripts, and held-out cases.
- `responsive-visual-composition` — standard; responsive primitives, narrative variation,
  hierarchy, visual scale, mobile recomposition, and browser evidence.
- `blinded-page-quality-benchmark` — standard; authorized Claude/OpenCode runs, reviewer
  blinding, complete distributions, iteration, and report.
- `first-use-comprehension-certification` — standard; real OUT-02/OUT-03 representative-user
  study and exact claimed support-cell coverage.
- `local-artifact-core-release` — high-risk; exact-package, support, migration, security,
  privacy, performance, supply-chain, and release-decision evidence.

Canonical scope and stopping condition: [Roadmap Phase 2](roadmap.md#phase-2--portable-page-completeness),
the benchmark's [hard gates](page-quality-benchmark.md#hard-gates) and
[equal-or-better threshold](page-quality-benchmark.md#equal-or-better-threshold), and the
[recurring certification gate](roadmap.md#recurring-certification-gate--prove-and-support-the-claimed-level).
Goal 6 starts from the resulting certified baseline.

## Goal 6 — Reliable local collaboration

### Copy-ready objective

```text
/goal Execute Goal 6 in docs/goal-runbook.md: implement, verify, and certify roadmap Phase 4
as Local collaboration. Keep the service loopback-only and bounded. Stop only when two
independent clients and publishers pass the canonical Phase 4 and accumulated release gates
linked below. Deliver on an agent/goal-6-local-collab branch with a draft PR unless I
authorize otherwise.
```

### Packets, work, and gate

- `local-collaboration-consistency` — high-risk; revision anchors, CAS, orphan handling,
  provenance, limits, and two-process races.
- `local-event-reconnect` — standard; watch/status, bounded SSE, restart, and reconnect.
- `local-datasource-boundary` — high-risk; fixed capability, permission, provenance,
  cancellation, limits, caching, and injection tests.
- `local-collaboration-release` — accumulated release/evidence packet.

Canonical scope and stopping condition: [Roadmap Phase 4](roadmap.md#phase-4--reliable-local-collaboration)
and the [recurring certification gate](roadmap.md#recurring-certification-gate--prove-and-support-the-claimed-level).
Freeze the verified shared collaboration semantics for authenticated hosting.

## Goal 7 — Honest public snapshots

### Copy-ready objective

```text
/goal Execute Goal 7 in docs/goal-runbook.md: implement, verify, and certify roadmap Phase 5A
as explicit public-static snapshots. Treat deployment as an audience increase. Stop only when
the canonical Phase 5A and accumulated release gates linked below pass, including authorized
provider evidence. Deliver on an agent/goal-7-public-snapshots branch; never mutate a real
site without explicit scoped authority.
```

### Packets, work, and gate

- `hosting-capability-visibility` — high-risk; enforced public-static vocabulary and audience
  transitions.
- `public-deploy-safety` — high-risk; exact staged scan, override scope, namespace isolation,
  content sandbox, and hostile tests.
- `public-deploy-lifecycle` — high-risk; dry-run, update, rollback, cleanup, teardown, fakes,
  and real smokes.
- `public-snapshot-policy-release` — privacy/operator/retention/abuse/cost docs and release evidence.

Canonical scope and stopping condition: [Roadmap Phase 5A](roadmap.md#5a-public-snapshot-adapters)
and the [recurring certification gate](roadmap.md#recurring-certification-gate--prove-and-support-the-claimed-level).
Retain provider/teardown evidence and resolve the linked authenticated-hosting decisions
before Goal 8.

## Goal 8 — Fail-closed authenticated hosting foundation

### Copy-ready objective

```text
/goal Execute Goal 8 in docs/goal-runbook.md: build and verify the fail-closed identity,
storage, isolation, content/control-plane, event, backup, and observability foundation for
Phase 5B. Resolve its canonical entry decisions first and stop only when the foundation gate
linked below passes. Do not claim authenticated collaboration. Deliver on an
agent/goal-8-auth-foundation branch with a draft PR unless I authorize otherwise.
```

### Packets, work, and gate

- `authenticated-reference-architecture` — high-risk ADR/design; identity proxy, closed origin,
  revision and strong mutable stores, events, regions, backups, and migration.
- `authenticated-origin-setup` — high-risk; idempotent setup/preflight and origin proof.
- `hosted-strong-state-isolation` — high-risk; transactions/CAS, composite tenancy,
  migrations, concurrency, and cross-authority tests.
- `hosted-content-control-separation` — high-risk; sandbox, credential, CSP/origin boundaries.
- `hosted-operations-foundation` — high-risk; health, observability, quotas, restore,
  rollout/rollback, capacity, cost, incident, and rotation.

Canonical scope and stopping condition: the foundation portion of
[Roadmap Phase 5B](roadmap.md#5b-authenticated-reference-deployment) and its
[decision register](roadmap.md#cross-phase-decision-register). This is an internal checkpoint,
not a release claim. Freeze its verified interfaces for Goal 9.

## Goal 9 — Authenticated collaboration

### Copy-ready objective

```text
/goal Execute Goal 9 in docs/goal-runbook.md: complete and certify Phase 5B as Authenticated
collaboration on Goal 8. Stop only when the canonical Phase 5B and accumulated release gates
linked below pass with authorized two-user/provider evidence. Deliver on an
agent/goal-9-auth-collab branch with a draft PR unless I authorize otherwise.
```

### Packets, work, and gate

- `hosted-audience-revision-policy` — high-risk; roles, audience, revocation, revision/follow,
  and server authorization.
- `hosted-live-collaboration` — high-risk; gallery/header, events/reconnect, state consistency,
  and degraded modes.
- `hosted-audit-data-rights` — high-risk; audit, retention, list/export/correct/delete,
  derived-data purge, backup expiry, and admin APIs.
- `authenticated-collaboration-release` — high-risk real two-user/isolation/failover/restore/
  origin-bypass evidence and release decision.

Canonical scope and stopping condition: [Roadmap Phase 5B](roadmap.md#5b-authenticated-reference-deployment)
and the [recurring certification gate](roadmap.md#recurring-certification-gate--prove-and-support-the-claimed-level).
Freeze the verified viewer, policy, audit, state, event, and operations contracts for Goal 10.

## Goal 10 — Connector-capable artifacts and complete target

### Copy-ready objective

```text
/goal Execute Goal 10 in docs/goal-runbook.md: implement, verify, and certify Phase 6 as
Connector-capable artifacts, then evaluate the complete definition in docs/product-spec.md.
Follow the canonical connector sequencing and keep optional actions unavailable unless their
gates pass. Stop only when the canonical Phase 6 gate, accumulated release gate, and complete
definition linked below pass. Deliver on an agent/goal-10-connectors branch with a draft PR.
```

### Packets, work, and gate

- `connector-capability-grants` — high-risk; signed manifest, grants, public prohibition,
  authorization, and captured/connect fallback.
- `connector-broker-boundary` — high-risk; credentials, allowlist, SSRF, sanitization,
  cancellation, quotas, and policy.
- `connector-cache-retry-isolation` — high-risk; full authority key, refresh, outage, replay,
  idempotency, saturation, and cross-viewer tests.
- `connector-governance-actions` — high-risk; organization controls, retention/audit export,
  cost guards, and an explicit ship-or-unavailable action decision.
- `complete-target-release` — high-risk final package/provider/security/privacy/operations/
  performance/compatibility/supply-chain/quality evidence and release decision.

Canonical scope and stopping condition: [Roadmap Phase 6](roadmap.md#phase-6--viewer-scoped-connectors-and-governance),
the [recurring certification gate](roadmap.md#recurring-certification-gate--prove-and-support-the-claimed-level),
and the product [definition of complete](product-spec.md#14-definition-of-complete). Missing
external evidence produces a blocker or reduced claim, never “done.”

## Final completion record

The final record is a completed [`docs/release-evidence-template.md`](release-evidence-template.md)
that resolves the product [definition of complete](product-spec.md#14-definition-of-complete)
through the current [traceability matrix](requirements-traceability.md), archived packets,
current specs, and dated specialist evidence. Those canonical records define the contents;
this runbook does not repeat their checklist.

“All done” is dated certification on the declared support/provider matrix. It does not mean
future dependency, host, provider, browser, or official-reference changes stop requiring
maintenance and re-verification.
