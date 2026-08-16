# Engineering principles

The durable engineering rulebook for this repository. The product specification owns
**what** the product must do; this file owns **how engineering decisions are made**. AGENTS.md
owns repository-working instructions, component-spec.md owns authoring syntax, and
`scripts/checks.ts` owns enforcement mechanics. One fact has one canonical home.

Rules marked `[check:<id>]` are machine-enforced by `scripts/check-repo.ts`; CI runs them on
every push. The eleven domains are MECE at the engineering-governance level. Product behavior is
collectively exhausted by [`docs/product-spec.md`](product-spec.md), not repeated here.

| Domain | Owns | Defers to |
|---|---|---|
| 1. Outcome and scope | value, priority, honest scope | product requirements and roadmap |
| 2. Trust and security | adversarial boundaries, least authority, exploit prevention | threat model |
| 3. Privacy and data governance | purpose, disclosure, retention, and personal-data rights | data inventory and privacy policy |
| 4. Data integrity and lifecycle | identity, transactions, recovery, artifact ownership | lifecycle requirements and schemas |
| 5. Architecture and compatibility | boundaries, extension points, portability, evolution | component/API specifications |
| 6. Experience and accessibility | clarity, visual quality, inclusive interaction | component spec and benchmark |
| 7. Reliability, performance, and cost | failure behavior, operability, resource budgets | measured budgets and runbooks |
| 8. Verification and evidence | how claims become accepted | tests and retained evidence |
| 9. Distribution and supply chain | what ships and how consumers trust it | release policy and CI artifacts |
| 10. Change and code stewardship | maintainability, documentation, versioned change | AGENTS.md workflow |
| 11. Agent and context design | model-facing interfaces and attention budget | skill/tool/AGENTS.md content |

## 1. Outcome and scope

- Optimize for the explicit user outcome and the smallest coherent change that achieves it.
  Record adjacent opportunities rather than silently expanding scope. (karpathy-guidelines,
  repo-local guidance)
- Preserve the product priority order: durable local authoring first, review and sharing
  second, administration third. Convenience never weakens security, privacy, recoverability,
  or truthfulness. (`OUT-01`)
- Commit to one approach while evidence supports it; reopen the choice when a test, user
  outcome, dependency, or risk contradicts it. (karpathy-guidelines)
- Capability language is an interface. Say local, public-static, authenticated, connected,
  shipped, partial, missing, or unverified according to enforced behavior and current
  evidence—never according to intent.
- A feature stops at the artifact boundary: a durable single-page capture plus bounded
  collaboration enhancements. Multi-route applications and general business backends belong
  in application deployment systems.

## 2. Trust and security

- Treat Markdown, metadata, component JSON, assets, paths, URLs, headers, request bodies,
  connector arguments/results, page JavaScript, and provider responses as untrusted at their
  boundary. Validate before authority or filesystem access; fail closed and within limits.
- Markdown uses `markdown-it` with `html: false`; raw HTML never passes through Markdown mode.
  Trusted HTML is a separately permissioned execution surface, never an implicit fallback.
- Every emitted page carries the strict on-disk CSP: `default-src 'none'; script-src
  'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'`. Served or
  hosted copies may relax `connect-src` only to the documented self boundary; the portable
  file never changes. No `unsafe-eval`, ever—Vega uses its `ast: true` interpreter.
  [check:csp-no-unsafe-eval] [check:vega-interpreter]
- Encode data for its exact HTML/CSS/URL/script context. Chart JSON is `\u003c`-escaped inside
  script payloads; user-facing text goes through the repository escaping helpers.
- Least authority is end to end: publishing, datasource execution, audience expansion,
  connector grant/call, trusted HTML, and destructive action have distinct scopes. Page code
  and public files never receive publisher, session, identity, connector, or administrator
  credentials.
- Scan the final bytes that cross an audience boundary, including title, metadata, assets,
  configuration, and staged files. Overrides are explicit, targeted, auditable, and do not
  become a remembered broader permission.
- Authentication is not authorization. Verify the identity boundary cannot be bypassed,
  authorize every server-side operation, namespace state/cache/audit data by all relevant
  authorities, and regression-test hostile cross-site/cross-viewer access.
- New trust boundaries require threat-model, abuse prevention, containment, incident,
  key-rotation, and recovery treatment before release. A security claim without an adversarial
  test is unresolved.

## 3. Privacy and data governance

- Every collected or transmitted field has a named capability-bound purpose, sensitivity,
  operator/controller, location, recipient, retention, and deletion path. “Useful later” is
  not a purpose.
- Local creation has no default telemetry. Analytics and studies are opt-in and consented;
  declining measurement never removes product capability.
- Operators, third parties, data regions, and unsupported compliance claims are disclosed at
  the boundary where a user selects hosting or a connector. Provider defaults are not treated
  as informed consent.
- Logs, metrics, fixtures, screenshots, traces, benchmarks, and support bundles minimize,
  pseudonymize, or avoid private content and identities. Private artifacts do not leave their
  deployment boundary without explicit authority.
- Users and authorized administrators can understand, list, export, correct where applicable,
  and delete the data the selected capability stores. Deletion covers derived copies and
  states documented backup expiry; it produces auditable completion evidence.
- Public sharing has an abuse, takedown, and intellectual-property path. Embedded third-party
  material retains required license and attribution; private or ambiguous reference artifacts
  are not redistributed.

## 4. Data integrity and lifecycle

- Artifact identity is stable; revisions are immutable; the selected head is mutable and
  auditable. Titles, slugs, paths, and presentation URLs are references, not identity.
- A stale check and its commit are one atomic concurrency operation. Mutations use a
  cross-process transaction, serialization, or compare-and-swap, never an unprotected
  read-modify-write sequence.
- Multi-file publication and state migration are crash-safe: after interruption, readers see
  a complete old state or a complete new state. Backups, repair, retry, and rollback are
  bounded, idempotent or resumable, and tested through fault injection.
- Stale refusals carry the bounded live metadata and content needed to merge and retry in one
  session. They never write a partial result or require rediscovery of artifact identity.
- Local state directories (`.state`, `.db`, `.datasources`) never enter a hosted publication.
  Datasources are publisher-registered fixed capabilities; viewers cannot supply commands.
- Users own portable output and supported exports. Provider choice, package removal, upgrade,
  or service disappearance must not strand the stable HTML or silently detach its state.
- Archive, restore, import, export, and state repair are explicit artifact operations.
  Destructive work names exact scope, transaction boundary, and recovery before execution.

## 5. Architecture and compatibility

- Preserve the pipeline boundary: **capture → author (Markdown/components) → render (fixed) →
  publish (interface)**. The renderer never trusts authored input; publishers never rewrite
  markup. (`docs/superpowers/specs/2026-08-14-opencode-artifacts-design.md`)
- New capabilities join through the narrowest existing extension point: a component fence,
  Publisher implementation, storage adapter, or documented local/hosted endpoint—not
  conditionals scattered across established units.
- The model authors declarative specifications. Arbitrary per-page JavaScript exists only in
  explicit trusted-HTML mode and does not inherit fixed-renderer guarantees.
- The portable page is the long-term compatibility layer. Services are progressive
  enhancement; no page-view dependency, account, package runtime, or network is required.
- Schemas, CLI/tool contracts, component syntax, exports, routes, and host adapters evolve by
  versioned migration and SemVer. Unknown future state fails without mutation; removals have
  a tested migration path.
- Platform differences—paths, locks, atomic replace, shells, launchers, fonts, locales, line
  endings, browsers, and host APIs—live behind explicit adapters and support-matrix tests.
- Current environment substrate: strict TypeScript, ESM/NodeNext, Node 24 native type
  stripping, no constructor parameter properties, and `.ts` relative import specifiers with
  `rewriteRelativeImportExtensions`. These constraints are implementation facts, not product
  requirements.

## 6. Experience, page quality, and accessibility

- Optimize every surface for the user's next decision: clear purpose, hierarchy, provenance,
  status, authority, consequences, and recovery. Empty, loading, denied, stale, offline,
  quota, and partial-service states are designed states.
- Correct and accessible is the floor; deliberate composition is the quality bar. Responsive
  pages recompose rather than shrink, use space intentionally, and avoid accidental clipping,
  dead zones, repetitive cards, and undersized primary visuals.
- Built-in interactions are keyboard-operable, expose semantic landmarks/names/state, have
  visible `:focus-visible`, support zoom and narrow viewports, and respect
  `prefers-reduced-motion`. Accessibility is verified with automation plus representative
  manual assistive-technology checks.
- Chart and data guidance is honesty-first: title the finding, preserve provenance, expose
  uncertainty/missing values, avoid exaggerated encodings, and summarize rather than inline
  unusably large datasets.
- Project tokens may alter declared design values, not execute code. Explicit prompt choices
  outrank project tokens; project tokens outrank curated defaults.
- “Equal or better” is comparative, not aesthetic rhetoric. It requires the current
  same-input, multi-run, blinded benchmark in `docs/page-quality-benchmark.md`; golden images
  establish regression stability only.

## 7. Reliability, performance, operability, and cost

- Every dependency and stateful boundary has named behavior for timeout, cancellation, retry,
  duplication, restart, partial failure, and degradation. Continue with last-known safe data
  only when authority and integrity remain valid.
- Errors are typed and actionable: what failed, what remained unchanged, and the next safe
  action. Silent catch is reserved for documented best-effort behavior: browser localStorage,
  tolerated deploy-provider probes, and absent/unreadable optional configuration or caches.
  Everything else propagates or is returned.
- Health, readiness, structured logs, metrics, alerts, and correlation identifiers are product
  operations, not post-launch extras. They remain bounded and redact content/credentials.
- Backups are not evidence until restore is tested. Rollouts, schema changes, and provider
  migrations have preflight, staged enablement, verification, rollback, and incident owners.
- Performance is governed by reproducible percentile budgets for render, useful page load,
  interaction, update delivery, memory/storage, and supported capacity. The 15 MiB cap applies
  to final expanded bytes before any write.
- Quotas and overload behavior protect existing data and tenant isolation. Warning thresholds
  precede hard limits; overload rejects safely and recovers without manual undocumented edits.
- Hosted and connector designs publish cost envelopes for idle, nominal, and limit workloads.
  Cost optimizations cannot trade away transactional consistency, isolation, accessibility,
  or offline portability.

## 8. Verification and evidence

- Every “done,” compatibility, privacy, security, performance, production-readiness, or parity
  claim rests on tool/user evidence from the same change or a still-current dated report.
  “Should pass” and screenshots without execution traces are not verification.
- Tests follow the risk pyramid: deterministic unit/property tests; transaction/concurrency/
  migration/fault tests; packed-host tests; browser/accessibility tests; fake-provider tests;
  then minimal real-provider smoke and recovery tests. Network and machine-specific state do
  not enter deterministic tests.
- New behavior lands with its test. One test should explain one behavior; external commands
  go through injectable boundaries such as `Runner`.
- User-visible HTML/CSS/JS changes are exercised in a browser at supported desktop/mobile
  widths and interaction modes; screenshots live in `docs/evidence/` with console/runtime
  results. Comparative quality uses all required runs and retains losing archetypes.
- Requirements trace in one direction: specification → roadmap/owner → test or manual
  protocol → dated evidence → release claim. The checked matrix must cover every normative ID.
  [check:file-traceability]
- CI runs install, build, test, structural checks, and pack inspection for every push/PR;
  local `npm run check` uses the same structural assertions. [check:file-ci]
- Failed, excluded, flaky, unsupported, and not-applicable outcomes are visible beside passes.
  Evidence is never cherry-picked to protect a claim.
- Contract Markdown links to repository files and headings are validated deterministically;
  authoritative external-source checks are bounded, dated, and report skipped or failed
  network results instead of treating configuration as evidence. [check:docs-link-integrity]

## 9. Distribution and supply-chain integrity

- The npm package follows official OpenCode plugin contracts: named plugin export,
  runtime dependencies in `dependencies`, and `@opencode-ai/plugin` as peer plus development
  dependency. Install instructions cover registry/config and tested non-registry development
  paths.
- Packed contents are deliberate and reviewable: `dist`, `skills`, README, and LICENSE ship;
  entrypoints, types, repository metadata, keywords, and runtime dependencies resolve from the
  tarball. [check:pkg-metadata] [check:pkg-files-skills] [check:file-license]
- Releases are built and tested from the exact packed bytes in clean supported hosts. They
  produce dependency/license/vulnerability evidence, SBOM, and provenance suitable for
  consumer integrity verification. Platform, provider, privacy, and provenance claims may
  pass only from exact dated evidence; absent or separately scoped observations stay
  unverified. [check:governance-policy]
- Public preview is a non-certified distribution state, not a weaker certification level. It
  may expose missing human, platform, parity, and production evidence only while claiming zero
  support and passing every exact security, privacy, package, trusted-publishing, integrity,
  signature, and provenance hard gate. Synthetic agents remain diagnostics; preview history
  never supplies a certification waiver.
- Dependencies default to zero additions. A dependency must justify capability, browser
  weight, CSP/network behavior, license, vulnerability surface, update ownership, and removal
  path. Conditional inlining is the exception that permits existing heavy visual runtimes.
- No dependency introduces a page-view network requirement. Previously created portable pages
  survive package/runtime removal because their required bytes are already embedded.
- Supported-version, deprecation, security-response, compromised-release, and end-of-life
  policies match actual staffing and test coverage; release notes name capability level,
  migrations, known limits, and evidence.

## 10. Change, code, and documentation stewardship

- Strict TypeScript: no `as any`, `@ts-ignore`, `@ts-expect-error`, or non-null assertion where
  a real runtime/type check exists. [check:no-as-any] [check:no-ts-ignore]
  [check:no-ts-expect-error]
- Use typed domain errors and explicit state transitions. Prefer readable direct code over
  abstraction without repeated need; keep security and transaction boundaries conspicuous.
- SemVer governs public authoring/tool/package contracts; pre-1.0 breaking changes require at
  least a minor release. Commits are conventional and atomic; secrets never enter history.
  [check:pkg-version-semver]
- Documentation has one canonical owner per fact, links claims to evidence, and names versions
  through tags or evidence metadata rather than prose that silently rots.
  [check:docs-no-version-pins]
- Standard and high-risk behavior changes follow the spec-anchored workflow in
  [`docs/adr/0001-spec-anchored-development.md`](adr/0001-spec-anchored-development.md): target
  intent, current shipped behavior, proposed deltas, and evidence remain separate; unresolved
  contract decisions block implementation; verified changes update current truth before
  archive. Deterministic structure and references are machine-checked. [check:spec-workflow]
- README follows the user funnel: what → evidence/demo → install → usage → limits →
  contributing → license. Its one-liner matches package/repository metadata; internal links
  resolve; the core contract documents remain present.
  [check:readme-one-liner] [check:readme-section-install] [check:readme-section-usage]
  [check:readme-section-limitations] [check:readme-section-contributing]
  [check:readme-section-license] [check:readme-links] [check:file-principles]
  [check:file-product-spec] [check:file-roadmap] [check:file-page-quality]
  [check:file-release-evidence-template] [check:file-component-spec]
  [check:file-comparison]
- A new or changed principle updates its requirement/evidence/check owner in the same change.
  Machine-checkable rules receive a registered `[check:<id>]`; the registry and principle tags
  must remain bijective.

## 11. Agent and context design

Sources: [Anthropic skill guidance](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills),
[Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
[OpenAI agent guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf),
[OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), and
[agents.md](https://agents.md/).

- Context is a finite attention budget. Include the smallest current set of high-signal facts
  that changes behavior; retrieve detail just in time and keep stable prefixes stable.
- Progressive disclosure is the load-bearing skill structure: compact trigger metadata →
  relevant SKILL.md (<500 lines) → one-level-deep references, with a contents list on long
  references. [check:file-skill] [check:file-skill-components]
  [check:file-skill-visuals]
- A skill/tool description is a trigger contract—what it enables and when to use it—not a
  duplicate API manual. High-signal gotchas grow from observed failures, not imagined rules.
  [check:file-skill-gotchas]
- AGENTS.md is the agent entrypoint: commands early, concrete repository facts, examples where
  style requires them, and always/ask/never boundaries. Nearest file wins.
  [check:file-agents]
- Inform judgment rather than encode brittle prompt conditionals. Use expressive typed tool
  interfaces; scripts beat prose for deterministic validation.
- Start with one agent/skill and split only when demonstrated complexity creates separable
  context or authority. Optional sub-agent definitions ship as explicit files.
  [check:file-agent-analyst]
- High-risk external actions keep a human checkpoint. Agent convenience never routes around
  permission, force, audience, destructive-action, or credential boundaries.
- Durable external state stores stable identifiers and summaries; large content is loaded on
  demand. Tool returns are bounded by default and expose full content only explicitly.
- Anti-patterns: whole-document context dumps, unbounded transcripts, repeated facts with no
  canonical owner, stale memory without supersession, examples that accidentally narrow an
  expressive tool, and deferred-loading everything.
- When the same model failure recurs, perform a retrospective, improve the canonical guidance
  or interface, add executable validation where possible, and re-evaluate it when the host
  model/tool generation changes.
