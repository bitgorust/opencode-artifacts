# OpenCode Artifacts product specification

Status: **Normative target**

Last reviewed: 2026-08-15

This document defines what `opencode-artifacts` is intended to become. It supersedes the
initial implementation proposal in
[`docs/superpowers/specs/2026-08-14-opencode-artifacts-design.md`](superpowers/specs/2026-08-14-opencode-artifacts-design.md).
The implementation roadmap is [`docs/roadmap.md`](roadmap.md).

## 1. Product definition

`opencode-artifacts` turns work produced in an OpenCode session into a durable, interactive,
self-contained web page that can be revised in place and deliberately shared.

The product is an open-source OpenCode-native analogue of Claude Code Artifacts, not a clone
of Anthropic's hosted service. It has two layers:

1. **Portable artifact:** one HTML file containing its content, styles, scripts, and embedded
   assets. It opens offline and has no backend dependency.
2. **Optional artifact service:** a local server or user-owned hosting adapter that adds live
   updates, collaboration, identity, access policy, and approved data bridges without
   changing the portable file on disk.

This separation is load-bearing. An artifact remains useful if this package, OpenCode, and
every hosting service disappear.

## 2. Authoritative baseline

The target behavior is grounded in public, official documentation. The
[Claude Code documentation index](https://code.claude.com/docs/llms.txt) currently lists one
dedicated Artifact guide; its Artifact entries and directly relevant references were audited
on 2026-08-15:

- Anthropic defines an artifact as a live, interactive page, private on creation, updated at
  one stable URL, versioned on every publish, and optionally shared with people, an
  organization, or the public: [Claude Code Artifacts](https://code.claude.com/docs/en/artifacts).
- Anthropic explicitly frames it as a **capture of work, not an application**: one
  self-contained page, strict CSP, no application backend, and a rendered limit of 16 MiB.
- The official [tools reference](https://code.claude.com/docs/en/tools-reference),
  [settings reference](https://code.claude.com/docs/en/settings),
  [environment-variable reference](https://code.claude.com/docs/en/env-vars), and
  [feature-availability table](https://code.claude.com/docs/en/feature-availability) define
  the permission, user controls, authentication/provider restrictions, and plan surface.
- The official [initial release digest](https://code.claude.com/docs/en/whats-new/2026-w25),
  [connector release digest](https://code.claude.com/docs/en/whats-new/2026-w29), and
  [Compliance API reference](https://platform.claude.com/docs/en/api/compliance/code/artifacts)
  cover the feature's evolution and organization lifecycle operations. The launch post is
  historical: where its beta-era plan or sharing statements conflict, the current guide wins.
- OpenCode officially supports npm plugins, plugin-provided typed tools, worktree-aware tool
  context, permissions, on-demand skills, and a headless server API:
  [plugins](https://opencode.ai/docs/plugins/),
  [custom tools](https://opencode.ai/docs/custom-tools/),
  [permissions](https://opencode.ai/docs/permissions/),
  [skills](https://opencode.ai/docs/skills), and
  [server](https://opencode.ai/docs/server/).
- OpenCode's V2 plugin API is documented as beta. The stable Promise plugin API remains the
  production target until V2 is stable; V2 is tracked through compatibility tests rather
  than used speculatively.

Reverse-engineered Claude Code strings may inform research, but they are not normative and
must not be used to claim official parity.

Local host evidence is recorded separately. A clean OpenCode 1.18.18 process loaded this
checkout and exposed all four plugin tools; Claude Code 2.1.233 was installed with the
official native installer and inspected, but could not perform a hosted publish because the
machine is not signed in to a Claude subscription. See
[`docs/evidence/opencode-host-verification.md`](evidence/opencode-host-verification.md) and
[`docs/evidence/claude-code-host-verification.md`](evidence/claude-code-host-verification.md).

## 3. Product principles

1. **Capture, not application.** Optimize for reports, walkthroughs, plans, comparisons,
   investigations, dashboards, and lightweight interactive decisions. Direct users to normal
   deployment tooling for multi-route applications and durable business systems.
2. **Private and local by default.** Creating a local artifact never creates a remote URL.
   Increasing its audience is a separate, explicit action.
3. **One artifact, one stable identity.** Title, filename, and URL presentation may change;
   the artifact identity does not. Updates require an explicit artifact reference.
4. **Immutable history, mutable head.** Every successful publish creates an immutable
   revision. A stable path or URL points at the selected head revision.
5. **Optimistic concurrency everywhere.** Updates compare the revision/hash the caller read
   with the current head. The comparison and commit are atomic across sessions and processes.
6. **Portable first.** The on-disk page works offline under a strict CSP. Server features are
   progressive enhancement.
7. **Declarative by default, trusted HTML by exception.** Markdown plus typed components is
   the normal authoring path. Raw HTML is an explicit trusted mode with a visibly weaker
   guarantee set.
8. **The viewer owns their authority.** A live connector call uses the viewer's grant and
   identity, never hidden publisher credentials. The page receives data, not credentials.
9. **Evidence before parity claims.** A feature is complete only when its real user surface
   is tested. Similar-looking output is not evidence of equivalent privacy or collaboration.
10. **Page quality is comparative.** Correct, accessible output is the floor. “Equal or
   better” requires a current, same-input, blinded comparison against Claude Code Artifacts;
   a curated screenshot or internal opinion is not enough.

## 4. Scope

### 4.1 In scope

- OpenCode plugin installation and typed artifact tools.
- Proactive artifact guidance through an on-demand skill or explicit plugin option.
- Markdown, declarative components/charts, and trusted raw-HTML authoring.
- Offline self-contained HTML, embedded local assets, gallery, immutable versions, restore,
  latest/open, and stale-update recovery.
- Local live preview with automatic refresh.
- Public snapshot deployment and authenticated team deployment to user-owned infrastructure.
- Optional comments, decisions, and small per-artifact documents when an artifact service is
  present.
- Eventually, viewer-authorized remote MCP connectors through a hosted broker.

### 4.2 Explicit non-goals

- A general web application framework, multi-route site builder, or arbitrary backend host.
- Silent publication, automatic public links, or a maintainer-operated multi-tenant SaaS.
- Executing viewer-supplied shell commands.
- Treating GitHub Pages as private or authenticated sharing.
- Passing publisher, worker, MCP, or identity-provider credentials into page JavaScript.
- Reproducing undocumented Claude internals merely for checkbox parity.

## 5. User journeys

### 5.1 Create

The user asks for a visual deliverable in ordinary language, or the agent recognizes a page
as the right medium. The agent authors a document, previews validation failures, asks for
permission, and publishes locally. The result returns an artifact ID, title, stable path,
revision, content hash, gallery path, and optional URL. Browser auto-open is configurable.

### 5.2 Revise

The agent updates by artifact ID/path/URL, not by guessing from the title. It supplies the
head revision/hash it read. If stale, publication fails without writes and returns the
current metadata plus a bounded current-content preview so the agent can merge and retry.
Every accepted update produces a new immutable revision and refreshes open local/hosted
viewers.

### 5.3 Review and bring results back

A viewer can inspect charts, compare options, tune declared controls, comment on anchored
content, or record a decision. Portable pages can copy/export a result. Served pages may
persist comments and decisions. The OpenCode session can read those results through typed,
read-oriented tools, act on them, and publish another revision.

### 5.4 Share

Sharing is distinct from rendering:

- **Local:** path only; no network publication.
- **Public snapshot:** an explicit GitHub Pages or public Cloudflare deployment with a clear
  warning that anyone with the URL can view it.
- **Authenticated team site:** private by default, identity-aware, explicit viewer/editor
  policy, version selection, revocation, and audit events.

Changing from private to broader visibility always requires a new permission checkpoint.

### 5.5 Use live data

Local pages may call only publisher-registered datasource names through the loopback server.
The registration records the exact command and fixed arguments; the viewer cannot alter
them. Hosted connector-backed pages declare connector/tool capabilities at publish time.
Each viewer grants access, calls run through that viewer's connection, and missing access
renders a useful fallback. Public artifacts cannot use authenticated connectors.

## 6. Requirement model

Requirements use **MUST**, **SHOULD**, and **MAY** in their RFC 2119 sense. The families are
deliberately MECE: each owns one kind of product decision, while cross-cutting acceptance is
expressed by references rather than duplicate requirements.

| Family | Owns | Does not own |
|---|---|---|
| `OUT` | users, jobs, success measures, release outcomes | interface details or implementation |
| `UX` | end-to-end human workflow and recovery | rendering internals or host APIs |
| `OC` | OpenCode host integration | generic package distribution |
| `LIFE` | artifact identity, revisions, metadata, and mutation semantics | storage service operations |
| `RENDER` | authored content transformed into the portable page | serving or sharing policy |
| `LOCAL` | loopback service behavior | portable-file rendering or remote hosting |
| `HOST` | remote sharing, identity, collaboration, and governance | connector execution |
| `CONN` | viewer-authorized remote data/action bridges | general hosting identity |
| `SEC` | adversarial protection and trust-boundary enforcement | personal-data purpose and retention |
| `PRIV` | data minimization, ownership, disclosure, retention, and deletion | exploit prevention |
| `OPS` | availability, recovery, observability, and incident operation | speed and capacity budgets |
| `PERF` | latency, resource, scale, rate, and cost envelopes | feature semantics |
| `COMPAT` | supported platforms, portability, schemas, and migration | release mechanics |
| `DIST` | packaging, release integrity, installability, and support policy | runtime compatibility behavior |
| `QUAL` | evidence needed to accept every other family | the behavior being proved |

A requirement has exactly one owning family. An implementation normally satisfies several
families at once; its acceptance evidence therefore references each applicable ID. The
coverage map is [`docs/requirements-traceability.md`](requirements-traceability.md).

### 6.1 Product outcomes

- **OUT-01:** The primary user MUST be an individual developer using OpenCode to turn session
  work into a durable page. Reviewers and small teams are the secondary audience;
  organization administrators are the tertiary audience. When priorities conflict, preserve
  local authoring first, review second, and administration third without weakening security.
- **OUT-02:** A first-time user on a supported clean machine MUST be able to install the
  released package, create an offline artifact, and reopen it by following only the README in
  at most ten minutes, without a repository checkout or hosting account.
- **OUT-03:** In the checked-in journey corpus, at least 90% of at least ten representative
  primary users MUST be able to identify the artifact's purpose, primary finding/state,
  provenance, and next action within one minute without maintainer assistance. A collaboration
  release additionally includes at least five representative secondary reviewers.
- **OUT-04:** Local artifact core, local collaboration, public snapshots, authenticated
  collaboration, and connector-capable artifacts MUST remain separately releasable outcomes.
  A release MUST meet every requirement assigned to its claimed level.
- **OUT-05:** Product-outcome measurement MUST use consented studies, local/CI benchmarks, or
  opt-in telemetry. The package MUST NOT send usage telemetry by default, and declining
  measurement MUST NOT reduce product functionality.
- **OUT-06:** Every roadmap phase MUST state its user outcome, dependencies, acceptance gate,
  owner role, effort range, material risks, and a stop/re-scope condition. Dates MAY be added
  only when staffing and external dependencies are known.

### 6.2 User experience

- **UX-01:** Create, revise, review, share, reconnect, export, archive, and restore workflows
  MUST have one documented primary path and MUST surface current artifact identity, revision,
  visibility, and target capability at the decision point.
- **UX-02:** Empty, loading, denied, stale, offline, quota, validation, and partial-service
  states MUST explain what happened, what remained unchanged, and the next safe action.
- **UX-03:** Increasing audience, executing a datasource, granting a connector, performing a
  side effect, deleting data, or using trusted HTML MUST be an explicit, scoped permission
  checkpoint. Repeated approval MUST never silently broaden scope.
- **UX-04:** Destructive actions MUST preview their exact scope, require confirmation, and
  state recovery/retention behavior before execution. Recoverable archive MUST be preferred
  to immediate irreversible deletion.
- **UX-05:** The CLI, plugin, local service, and hosted surface MUST use the same capability and
  visibility vocabulary. Labels such as private, public, live, versioned, and connected MUST
  describe enforced behavior rather than setup advice.
- **UX-06:** A user MUST be able to export an artifact with its portable page, metadata,
  revision history, comments/decisions, and supported small documents in a documented,
  versioned format. Import MUST validate before mutation and report unsupported content.
- **UX-07:** Product chrome and workflow output MUST support Unicode, explicit time zones,
  locale-aware numbers/dates, and both left-to-right and right-to-left user input. Shipped
  interface strings MAY remain English until localization is offered, but MUST NOT be
  embedded in user data schemas. Artifact-content accessibility remains owned by `RENDER-06`.
- **UX-08:** Installation, authentication, deployment, and connector failures MUST expose a
  bounded diagnostic path that redacts secrets and identifies the failing layer. Uninstall
  and site teardown documentation MUST distinguish retained artifacts from removed runtime
  state.

### 6.3 OpenCode integration

- **OC-01:** The npm package MUST load through the current stable OpenCode plugin API and
  register `artifact_publish`, `artifact_db`, `artifact_state`, and `artifact_comments`.
- **OC-02:** Installation MUST support `opencode plugin opencode-artifacts`, direct config via
  the documented `plugin` array, and a local package/path development workflow.
- **OC-03:** CI MUST test the packed npm artifact against the latest supported stable OpenCode
  release. Workspace-only plugin tests are insufficient.
- **OC-04:** The compatibility policy MUST name the oldest tested OpenCode release and track
  current stable. A peer range without host tests is not a compatibility guarantee.
- **OC-05:** The artifact skill MUST follow OpenCode's official skill discovery/frontmatter
  rules and remain optional/on-demand unless proactive mode is explicitly enabled.
- **OC-06:** Publication and deployment MUST use OpenCode permission checkpoints. Deployment
  permission resources MUST distinguish target, artifact, and visibility.

### 6.4 Artifact identity and lifecycle

- **LIFE-01:** Each artifact MUST have a stable opaque ID and a human-readable slug. Slug or
  title changes MUST NOT create a different identity unless explicitly requested.
- **LIFE-02:** Every successful publish MUST create one immutable monotonically numbered
  revision, including the first publish and updates made without a history flag.
- **LIFE-03:** Stable paths/URLs MUST resolve to a selected head revision. Restore changes the
  head by creating an auditable revision or pointer event; it MUST NOT destroy history.
- **LIFE-04:** Create, update, restore, manifest mutation, and gallery generation MUST be one
  serialized transaction across processes. Crashes MUST leave either the old or new complete
  state, never a mixed state.
- **LIFE-05:** Update MUST accept an artifact ID/path/URL plus expected revision/hash. A stale
  failure MUST contain enough bounded live content and metadata to merge without another
  discovery call.
- **LIFE-06:** List, read/status, and delete/archive lifecycle operations MUST be available to
  both the CLI and plugin. Destructive operations require confirmation and are recoverable
  where practical.
- **LIFE-07:** Metadata MUST use a versioned schema and include ID, slug, title, icon,
  description, timestamps, head revision, revisions, byte size, content hash, provenance,
  author when known, and deployment references.

### 6.5 Authoring and rendering

- **RENDER-01:** Markdown mode MUST reject raw HTML passthrough and escape all user text.
- **RENDER-02:** The declarative format MUST support the documented components, tables,
  Vega/Vega-Lite/ECharts charts, Mermaid, anchors, task lists, and alerts with schema-level
  validation and inline actionable errors.
- **RENDER-03:** Trusted HTML mode MUST be an explicit opt-out. The permission prompt and
  result metadata MUST identify it as trusted code authored for the page.
- **RENDER-04:** The renderer MUST inline only required runtimes and MUST embed referenced
  local images/fonts/assets as data URIs or generated markup. Missing, external, or oversized
  assets fail with actionable errors; a strict offline page never silently renders broken
  remote content.
- **RENDER-05:** The final bytes written after all footer/asset expansion MUST not exceed the
  package cap. The cap MAY remain below Claude's documented 16 MiB ceiling; the default is
  15 MiB.
- **RENDER-06:** Pages MUST be keyboard operable, readable in supported color modes and at
  200% zoom, respect reduced motion, preserve logical order for left-to-right and right-to-left
  content, expose meaningful landmarks/labels, and meet WCAG 2.2 AA for the built-in renderer.
- **RENDER-07:** Project design tokens, when explicitly configured or discoverable from a
  documented source, MUST outrank the built-in theme. Prompt choices outrank both. No source
  may cause arbitrary code execution.
- **RENDER-08:** Data pages MUST preserve provenance and distinguish captured-at data from
  live data. Charts MUST follow the honesty rules in `docs/component-spec.md`.
- **RENDER-09:** Layout MUST use hierarchy, typography, spacing, color, density, and visual
  scale intentionally. Pages MUST NOT ship accidental dead zones, undersized primary
  visuals, clipped labels, or template repetition that obscures the task's narrative.
- **RENDER-10:** Charts, diagrams, mockups, comparisons, diffs, and media MUST adapt to their
  container and viewport. A responsive page MUST recompose for narrow screens rather than
  merely shrink a fixed desktop canvas.
- **RENDER-11:** The normal Markdown/component path MUST cover the core page-quality corpus:
  dashboard, incident, PR walkthrough, system explainer, alternative comparison,
  plan/checklist, findings table, and interactive decision. Raw HTML MAY raise the bespoke
  ceiling but MUST NOT be required to pass the core corpus.
- **RENDER-12:** An equal-or-better quality claim MUST pass the current same-input,
  multi-run, blinded benchmark and absolute hard gates in
  [`docs/page-quality-benchmark.md`](page-quality-benchmark.md). Without an authenticated
  Claude reference run, the claim remains unverified.

### 6.6 Portable page and local service

- **LOCAL-01:** The on-disk page MUST use the strict CSP in the engineering principles and
  make no view-time network request.
- **LOCAL-02:** `serve` MAY relax `connect-src` only to loopback self and inject only the
  documented bridge. It MUST reject traversal, malformed URL encodings, oversized bodies,
  invalid names, and unsupported methods without terminating.
- **LOCAL-03:** Live reload MUST refresh an already-open page after the head changes and
  reconnect safely after a temporary server restart.
- **LOCAL-04:** Comments, decisions, and mini-database writes MUST be atomic and concurrency
  safe. Limits apply to document size, collection size, thread count, and request rate.
- **LOCAL-05:** Datasources MUST be registered at publish time, use fixed commands/arguments,
  have time/output limits, expose their provenance in the page, and require a distinct
  execution permission. They MUST remain unavailable on static/public hosts.

### 6.7 Hosting and sharing

- **HOST-01:** A deployment target MUST declare its capability class: `public-static`,
  `authenticated`, or `connector-capable`. The UI and result MUST never imply capabilities
  the target lacks.
- **HOST-02:** GitHub Pages is `public-static`: no secrets, viewer identity, writable state,
  private links, or live connectors.
- **HOST-03:** The reference authenticated target MUST be private by default and verify its
  access layer before reporting a private URL. Merely documenting an optional external
  access setup is not authenticated-sharing support.
- **HOST-04:** Authenticated hosting MUST support author identity, viewer/editor roles,
  explicit audience changes, revocation, immutable revision selection, “follow latest,” and
  a per-user gallery.
- **HOST-05:** Open hosted viewers MUST receive head updates without a manual reload, with
  bounded reconnect/poll behavior.
- **HOST-06:** Hosted mutable state MUST be strongly consistent for conflicting writes or use
  explicit compare-and-swap. Eventually consistent KV read-modify-write is insufficient for
  comments, decisions, and document updates.
- **HOST-07:** Publish, share-policy change, revision selection, connector grant/call, and
  deletion MUST emit bounded audit events. Data retention and deletion semantics are owned by
  `PRIV-05`; organization policy controls are owned by `HOST-09`.
- **HOST-08:** Public deployment MUST scan the final staged files for credential-looking
  content and block without an explicit force override. Authenticated deployment SHOULD use
  the same floor.
- **HOST-09:** Organization administration MUST be able to disable artifacts, connector calls,
  and public sharing independently; scope enablement by role; configure retention; and list,
  retrieve, export, and delete artifacts without relying on the publishing session.
- **HOST-10:** Hosted artifact code MUST run in a sandboxed, unprivileged content boundary
  separate from the authenticated control plane. Page JavaScript MUST NOT receive session,
  identity-provider, connector, or administration credentials.

### 6.8 Viewer-scoped connectors

- **CONN-01:** Connector capability names and exact tools MUST be declared at publish time.
  Undeclared calls are rejected server-side.
- **CONN-02:** Each viewer MUST grant a connector before first use. The broker calls with the
  viewer's identity and never exposes credentials to the artifact.
- **CONN-03:** Connector sections MUST render captured data or a named fallback when live data
  is unavailable or declined.
- **CONN-04:** Public artifacts MUST NOT call authenticated connectors.
- **CONN-05:** Read-only connectors ship before side-effecting actions. Actions require a
  second per-call confirmation, policy evaluation, idempotency key, and audit record.
- **CONN-06:** Local MCP servers may supply captured data while authoring but MUST NOT be
  presented as remotely callable after deployment.
- **CONN-07:** Connector response caches MUST be partitioned by viewer, artifact, revision,
  connector, tool, and normalized arguments. A cached render MAY appear immediately, but it
  MUST refresh under a bounded policy and MUST never cross viewer authority boundaries.

## 7. Security requirements

### Trust boundaries

| Boundary | Trusted | Untrusted |
|---|---|---|
| Renderer | fixed package code | Markdown, metadata, component JSON, asset contents |
| Trusted HTML | user-approved page source | any data inserted into it later |
| Local service | route/bridge implementation, registered datasource definitions | URL, body, page-origin requests |
| Hosted service | worker/control plane, verified identity headers | asset request, viewer input, page JavaScript |
| Connector broker | capability manifest and policy engine | artifact arguments and connector responses |

### Required controls

- **SEC-01:** The repository MUST maintain a versioned threat model covering portable pages,
  trusted HTML, filesystem inputs, loopback service, hosted control/content planes,
  identity/audience changes, collaboration state, deployment adapters, and connectors. New
  trust boundaries block release until modeled and tested.
- **SEC-02:** Every external name, URL, path, header, body, component payload, archive, and
  connector argument MUST be treated as untrusted. Names are allowlisted; resolved paths
  remain under their roots; malformed encodings and oversized inputs fail closed.
- **SEC-03:** Credential scanning MUST inspect final rendered/staged content, metadata,
  titles, embedded assets, and deployment configuration. Overrides are explicit, targeted,
  auditable, and never remembered for a wider artifact, site, or audience.
- **SEC-04:** Markdown pages MUST prevent raw-HTML injection, script-payload breakout,
  undeclared view-time network access, framing/clickjacking, and access to authenticated
  control-plane credentials. CSP changes require review and regression tests; `unsafe-eval`
  is forbidden.
- **SEC-05:** Authentication and authorization MUST fail closed. Identity headers are trusted
  only from a verified proxy on an origin that cannot be reached around that proxy. Every
  read, mutation, share, administrative, and connector action is authorized server-side.
- **SEC-06:** Hosted state, caches, queues, keys, routes, and logs MUST be partitioned by site,
  artifact ID, revision where relevant, and viewer authority where relevant. Isolation tests
  MUST attempt cross-site, cross-artifact, and cross-viewer access.
- **SEC-07:** Mutable writes MUST use serialization, transactions, or compare-and-swap;
  untrusted requests MUST have body, rate, time, output, and resource limits. Retries MUST not
  duplicate a committed mutation or connector side effect.
- **SEC-08:** Connector and datasource execution MUST be allowlisted, time/output bounded,
  cancellable, auditable, and protected from SSRF and argument/command injection. Page code
  receives sanitized results, never credentials or unrestricted network access.
- **SEC-09:** Security-relevant audit records MUST be append-only or tamper-evident, bounded,
  access-controlled, clock-normalized, and redact secrets. Security diagnostics MUST not echo
  credentials, identity tokens, entire pages, or connector payloads.
- **SEC-10:** The project MUST publish a private vulnerability-reporting path, severity and
  response policy, supported-version window, key-rotation procedure, and compromised-release
  playbook before authenticated collaboration is declared production-ready.

## 8. Privacy and data-governance requirements

- **PRIV-01:** A versioned data inventory MUST identify each stored/transmitted field, its
  purpose, controller/processor role, location, sensitivity, retention, and deletion path for
  local, public-static, authenticated, and connector-capable modes.
- **PRIV-02:** Local creation MUST remain local and telemetry-free by default. Hosted and
  connector features MUST collect only data necessary for the user-selected capability, and
  optional analytics require informed opt-in.
- **PRIV-03:** Credentials, session tokens, connector grants, private identity headers, and
  administrative secrets MUST never enter portable pages, artifact exports, browser-visible
  configuration, public deployment trees, or user-visible error text.
- **PRIV-04:** Deployment documentation and setup output MUST state who operates the target,
  where data is stored when known, which third parties receive it, and whether regional
  residency can be selected. Unsupported residency/compliance claims MUST not be implied.
- **PRIV-05:** Users and authorized administrators MUST be able to list, export, correct where
  applicable, and delete artifact-related personal data. Deletion MUST cover primary stores,
  derived indexes/caches, and documented backup expiry, with an auditable completion result.
- **PRIV-06:** Logs, metrics, traces, support bundles, fixtures, and benchmark evidence MUST
  minimize or pseudonymize identities and content, apply declared retention, and require
  explicit authorization before private artifacts leave their deployment boundary.
- **PRIV-07:** Public-sharing documentation and the reference host MUST define reporting,
  takedown, abuse, and intellectual-property handling. Embedded third-party content MUST retain
  required attribution and license information.

## 9. Reliability and operations requirements

- **OPS-01:** Each service-backed release level MUST publish availability, durability, and
  support objectives for its reference deployment. Before production readiness, the
  authenticated reference target MUST demonstrate at least 99.9% monthly control-plane
  availability excluding declared maintenance; local-only and user-modified deployments MUST
  be labeled as having no operator-provided SLA.
- **OPS-02:** Local and hosted services MUST expose bounded health/readiness diagnostics and
  structured, redactable logs with request/site/artifact correlation. Hosted reference
  deployments MUST define metrics and alerts for errors, latency, saturation, auth failures,
  event delivery, storage failures, and connector failures.
- **OPS-03:** Mutable local and hosted stores MUST have documented backup, restore, integrity
  verification, and disaster-recovery procedures. The authenticated reference target MUST
  target an RPO of five minutes and RTO of sixty minutes, and MUST test restoration before a
  production-ready claim.
- **OPS-04:** Crashes, restarts, network loss, expired identity, unavailable connectors, quota
  exhaustion, and partial provider outages MUST leave a comprehensible degraded mode. Reads
  of last-known safe content SHOULD continue when authority and integrity can be preserved.
- **OPS-05:** Deployments and schema migrations MUST support preflight, staged rollout,
  rollback, and post-change verification. A failed rollout MUST preserve or restore the last
  known good page, policy, and compatible state.
- **OPS-06:** Incident runbooks MUST name detection, containment, credential rotation,
  recovery, user notification, evidence retention, and follow-up ownership for data exposure,
  cross-tenant access, corrupt history, unavailable sites, and compromised releases.
- **OPS-07:** State repair, reindexing, cache invalidation, export, deletion, and migrations
  MUST be idempotent or resumable and report progress without requiring direct undocumented
  store edits.
- **OPS-08:** Supported capacity MUST be observable. Crossing a warning threshold MUST produce
  an actionable signal before the hard quota, and hard-quota behavior MUST reject safely
  without corrupting existing artifacts.

## 10. Performance, scale, and cost requirements

- **PERF-01:** The repository MUST keep a reproducible performance harness and versioned
  budgets for representative no-runtime, one-chart, multi-runtime, local-collaboration,
  hosted, and connector workloads. Environment, corpus, percentile, warm/cold state, and
  measurement noise MUST be reported with results.
- **PERF-02:** On the documented two-core/4 GiB reference environment, CLI rendering MUST meet
  a p95 budget of two seconds for the no-runtime fixture and five seconds for the
  multi-runtime fixture, excluding an explicitly reported first dependency install.
- **PERF-03:** On the benchmark browser profile, portable pages MUST reach useful content
  within 1.5 seconds (no runtime), 3 seconds (one chart runtime), or 5 seconds (multiple
  runtimes), and become keyboard-interactive within one additional second. Mobile results
  MUST be reported separately and may not exceed twice the corresponding desktop budget.
- **PERF-04:** Loopback head/comment events MUST normally become visible within two seconds and
  reconnect within five seconds. The hosted reference target MUST publish and meet p95 read,
  write, and update-delivery budgets; connector-provider latency MUST be reported separately.
- **PERF-05:** The final-page byte cap is owned by `RENDER-05`. Revision count, artifact count,
  mutable document/thread sizes, concurrent viewers, request rate, and connector response
  limits MUST each have documented defaults, tested hard limits, and an operator override
  range before the feature leaves its roadmap phase.
- **PERF-06:** Load and soak tests MUST cover the documented supported-capacity profile plus a
  controlled overload case. Overload MUST preserve tenant isolation, bounded memory/disk use,
  response limits, and recoverability.
- **PERF-07:** Hosted reference documentation MUST provide a cost model for idle, nominal, and
  limit workloads, identify provider-billed operations, and supply quotas/budgets that prevent
  accidental unbounded spend. A cheaper design MUST not weaken consistency or isolation.

## 11. Compatibility, portability, and migration requirements

- **COMPAT-01:** The support matrix MUST name tested Node, OpenCode, OS, desktop browser, and
  mobile browser ranges. The target floor is Node 24+, current and oldest-supported stable
  OpenCode, current Ubuntu LTS, current and previous macOS, Windows 11, and the latest two
  stable Chromium/Firefox/Safari releases where available.
- **COMPAT-02:** The portable HTML file is the long-term compatibility artifact. It MUST remain
  openable without this package, OpenCode, a service worker, an installed runtime, or a
  network connection on every supported browser.
- **COMPAT-03:** Manifest, state, export, and capability schemas MUST carry integer versions.
  Migrations are forward-only, idempotent, backed up, fault-tested, and verified from every
  supported prior schema. Unknown future schemas fail without mutation.
- **COMPAT-04:** Package upgrades MUST NOT detach or cross-wire local or hosted state.
  Namespace, identity, or provider-store migrations require preflight, copy/verify, rollback,
  and an operator-visible completion report.
- **COMPAT-05:** CLI commands, tool arguments/results, component syntax, routes, and export
  formats MUST follow the published SemVer/deprecation policy. Removals require a migration
  path and at least one supported release of notice unless closing an actively exploitable
  vulnerability.
- **COMPAT-06:** The stable OpenCode plugin API remains the production target until a packed
  host test proves a migration. Beta adapters MUST use separate, explicit entrypoints and
  MUST NOT silently change stable behavior.
- **COMPAT-07:** Export/import MUST preserve all representable identities, revisions,
  timestamps/time zones, authorship provenance, policy, comments, decisions, and documents.
  Unsupported hosted features MUST be reported, never silently discarded.
- **COMPAT-08:** Platform-specific paths, shells, browser launchers, fonts, locales, and line
  endings MUST be isolated behind tested adapters. Unsupported combinations fail during
  preflight rather than after partial publication.

## 12. Distribution, supply-chain, and support requirements

- **DIST-01:** CI MUST build, test, structurally check, and inspect the exact packed npm
  artifact. A clean supported host install from that tarball MUST expose the documented tools,
  skill, CLI, license, types, runtime dependencies, and no repository-only files.
- **DIST-02:** Registry, official OpenCode configuration, and local-development installation
  paths MUST be tested and documented from clean state. Published packages MUST remain usable
  across patch fixes unless a documented security issue requires otherwise.
- **DIST-03:** Releases MUST use SemVer and Conventional Commits, include generated or checked
  release notes, state their release level/capabilities, name migrations and known limits,
  and link the evidence supporting any parity or production-readiness claim.
- **DIST-04:** Release CI MUST produce an SBOM and provenance/attestation for the packed bytes,
  scan runtime and development dependencies for known vulnerabilities and incompatible
  licenses, and document how consumers verify package integrity.
- **DIST-05:** Dependencies and vendored browser runtimes MUST be pinned through the lockfile,
  reviewed for license/network/CSP impact, updated under tests, and removable without losing
  access to already-created portable pages.
- **DIST-06:** The project MUST publish supported-version, deprecation, vulnerability-response,
  and end-of-life policies. At least the current minor receives security fixes; broader
  support MUST be stated only when staffed and tested.
- **DIST-07:** Documentation, generated examples, embedded assets, fonts, and benchmark
  references MUST have compatible licenses and attribution. Private or ambiguously licensed
  Claude artifacts MUST not be redistributed.

## 13. Verification and evidence requirements

- **QUAL-01:** Every normative requirement MUST appear exactly once in this specification and
  map to a roadmap phase/release gate, accountable role, automated or manual acceptance
  evidence, and current status in `docs/requirements-traceability.md`.
- **QUAL-02:** New behavior MUST land with tests at the lowest useful level. Validation,
  rendering, storage, concurrency, migrations, and security boundaries require deterministic
  tests independent of network, wall-clock ordering, and developer-specific paths.
- **QUAL-03:** Packed-plugin behavior MUST be tested with `npm pack`, a clean OpenCode
  config/cache, and the live tool discovery endpoint (or stable successor) for the oldest and
  current supported OpenCode versions.
- **QUAL-04:** User-visible changes MUST be tested through their real surface at desktop and
  mobile widths, keyboard-only, supported color modes, accessibility tooling plus manual
  screen-reader checks, zero unexpected console errors, and retained evidence for visual
  changes.
- **QUAL-05:** Every deployment adapter requires fake-runner tests and a real smoke deployment.
  Authenticated/collaborative targets additionally require two-user isolation, concurrency,
  revocation, backup/restore, and fail-closed origin tests.
- **QUAL-06:** Threat-model tests MUST cover audience change, identity/header spoofing, CSRF,
  CORS, clickjacking, path traversal, malformed encoding, script breakout, SSRF, secret
  publication, tenant/cache isolation, stale/replayed writes, resource exhaustion, crash
  recovery, and connector retry/idempotency.
- **QUAL-07:** A page-quality claim requires the dated prompts, fixtures, all required runs,
  interaction traces, hard-gate results, blinded rubric distributions, reference environment,
  and authorization metadata defined in `docs/page-quality-benchmark.md`.
- **QUAL-08:** Release evidence MUST state failures, exclusions, flaky-test disposition, and
  unsupported platforms as visibly as successes. Documentation and the README capability
  matrix MUST be checked against this requirement set before release.

## 14. Definition of complete

The product reaches the complete target only when:

- all `OUT`, `UX`, `OC`, `LIFE`, `RENDER`, `LOCAL`, `SEC`, `PRIV`, `OPS`, `PERF`, `COMPAT`,
  `DIST`, and `QUAL` requirements assigned to the claimed release level pass on supported
  platforms;
- the core visual corpus passes `RENDER-09` through `RENDER-12`, including the comparative
  threshold in the page-quality benchmark;
- public-static and authenticated target labels are enforced, not merely documented;
- authenticated sharing satisfies `HOST-03` through `HOST-10`;
- hosted live updates and strongly consistent collaboration are verified with two viewers;
- viewer-scoped read connectors satisfy every `CONN` requirement, with action connectors
  either satisfying `CONN-05` or remaining explicitly unavailable;
- every applicable `HOST` requirement passes before an authenticated release and every
  applicable `CONN` requirement passes before a connector-capable release;
- migration tests prove existing local artifacts and hosted state survive upgrades; and
- the traceability matrix has no unassigned requirement, missing evidence, unresolved release
  blocker, or unsupported claim, and the README is checked against that matrix and current
  official docs.

Until then, releases should describe the shipped level precisely: **local artifact core**,
**public snapshot hosting**, or **authenticated collaboration**, rather than “complete
Claude Artifacts parity.”
