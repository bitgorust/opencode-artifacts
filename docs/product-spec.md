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

## 6. Functional requirements

Requirements use **MUST**, **SHOULD**, and **MAY** in their RFC 2119 sense.

### 6.1 OpenCode integration

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

### 6.2 Artifact identity and lifecycle

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

### 6.3 Authoring and rendering

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
- **RENDER-06:** Pages MUST be responsive, keyboard operable, readable in light/dark modes,
  respect reduced motion, expose meaningful landmarks/labels, and meet WCAG 2.2 AA for the
  built-in renderer.
- **RENDER-07:** Project design tokens, when explicitly configured or discoverable from a
  documented source, MUST outrank the built-in theme. Prompt choices outrank both. No source
  may cause arbitrary code execution.
- **RENDER-08:** Data pages MUST preserve provenance and distinguish captured-at data from
  live data. Charts MUST follow the honesty rules in `docs/component-spec.md`.

### 6.4 Portable page and local service

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

### 6.5 Hosting and sharing

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
  deletion MUST emit bounded audit events. Retention and deletion MUST be configurable.
- **HOST-08:** Public deployment MUST scan the final staged files for credential-looking
  content and block without an explicit force override. Authenticated deployment SHOULD use
  the same floor.
- **HOST-09:** Organization administration MUST be able to disable artifacts, connector calls,
  and public sharing independently; scope enablement by role; configure retention; and list,
  retrieve, export, and delete artifacts without relying on the publishing session.
- **HOST-10:** Hosted artifact code MUST run in a sandboxed, unprivileged content boundary
  separate from the authenticated control plane. Page JavaScript MUST NOT receive session,
  identity-provider, connector, or administration credentials.

### 6.6 Viewer-scoped connectors

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

## 7. Security and privacy model

### Trust boundaries

| Boundary | Trusted | Untrusted |
|---|---|---|
| Renderer | fixed package code | Markdown, metadata, component JSON, asset contents |
| Trusted HTML | user-approved page source | any data inserted into it later |
| Local service | route/bridge implementation, registered datasource definitions | URL, body, page-origin requests |
| Hosted service | worker/control plane, verified identity headers | asset request, viewer input, page JavaScript |
| Connector broker | capability manifest and policy engine | artifact arguments and connector responses |

### Required controls

- Credential scanning happens on final published/staged content, including titles and assets.
- Secret overrides are explicit, targeted, auditable, and never remembered for broader scopes.
- Filesystem names are validated; resolved paths stay under their roots.
- Manifest and mutable-state writes use atomic replace/CAS and have bounded recovery.
- Hosted state is namespaced by deployment/site and artifact ID.
- CSP changes require review and tests; no `unsafe-eval`.
- Identity headers are accepted only from a verified proxy/Access configuration, never from a
  directly reachable worker request.
- Error/tool output is bounded and does not echo full credentials or entire large pages.

## 8. Compatibility and data migration

- The portable HTML file is the long-term compatibility artifact.
- Manifest/state schemas carry an integer schema version and migrations are forward-only,
  idempotent, backed up, and tested from every supported prior schema.
- A package upgrade MUST NOT silently detach existing hosted state. Namespace or storage
  migrations require a documented copy/rollback path.
- CLI and tool argument removals follow SemVer. New pre-1.0 arguments require a minor release.
- The stable OpenCode plugin API is supported until a tested migration exists. A V2 adapter
  may coexist behind a separate entrypoint while V2 remains beta.

## 9. Quality gates

A capability is complete only when all applicable evidence exists:

1. Unit tests for validation, rendering, storage, concurrency, and security boundaries.
2. Packaged-plugin host test using `npm pack`, a clean OpenCode config/cache, and the live
   `/experimental/tool/ids` endpoint (or its stable successor).
3. Browser tests at mobile and desktop widths, keyboard-only interaction, accessibility scan,
   zero unexpected console errors, and screenshots for visual changes.
4. Deployment adapter tests with fake runners plus a real smoke deployment for each target.
5. Threat-model cases for audience changes, identity spoofing, connector grants, secret
   publication, cross-site state isolation, stale writes, and crash recovery.
6. Documentation that states the target's real privacy and state capabilities without parity
   shorthand.

## 10. Definition of complete

The product reaches the complete target only when:

- all `OC`, `LIFE`, `RENDER`, and `LOCAL` requirements pass on supported platforms;
- public-static and authenticated target labels are enforced, not merely documented;
- authenticated sharing satisfies `HOST-03` through `HOST-10`;
- hosted live updates and strongly consistent collaboration are verified with two viewers;
- viewer-scoped read connectors satisfy every `CONN` requirement, with action connectors
  either satisfying `CONN-05` or remaining explicitly unavailable;
- migration tests prove existing local artifacts and hosted state survive upgrades; and
- the README parity summary is generated from or manually checked against this requirement
  set and current official docs.

Until then, releases should describe the shipped level precisely: **local artifact core**,
**public snapshot hosting**, or **authenticated collaboration**, rather than “complete
Claude Artifacts parity.”
