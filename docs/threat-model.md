# Threat model

Model version: 1. Last reviewed: 2026-08-16. Owner: Security maintainer.

Review this model when a trust boundary, parser/runtime, storage schema, audience, deployment
provider, identity/grant model, dependency, CSP, or release authority changes, and after a
relevant incident. A boundary with missing controls/tests fails its capability claim. Planned
boundaries describe required future work and are never evidence of shipped protection.

## Portable declarative pages

- Assets/authority: authored Markdown/JSON, generated HTML and browser execution; renderer
  code owns the trusted shell.
- Untrusted input/threats: text, component specs and chart data may inject markup/scripts,
  escape a script context, request a network resource, exhaust rendering, or leak a secret.
- Controls/tests: Markdown raw HTML is escaped, user text uses escaping helpers, component
  schemas reject malformed values, JSON/script boundaries are encoded, final size is capped,
  credential patterns block publication, runtimes are inlined, and on-disk CSP has
  `connect-src 'none'`; renderer/component/guard tests cover adversarial inputs.
- Residual risk: scanners and schema coverage are finite; complex vendored browser runtimes
  retain upstream vulnerabilities and untrusted content can still reveal non-secret private
  information if the author publishes it.

## Trusted HTML mode

- Assets/authority: explicit `format: "html"` input and the renderer shell; the author holds
  code-execution authority for that page.
- Untrusted input/threats: arbitrary HTML/JavaScript can mislead viewers, read page-local data,
  consume resources, or weaken declarative-renderer guarantees.
- Controls/tests: the mode is explicit, still receives the outer CSP/size/secret scan, and is
  documented as outside fixed-renderer content safety.
- Residual risk: content is intentionally trusted and should never be accepted from an
  untrusted author. Current tests do not sandbox it from same-page state.

## Filesystem and local state

- Assets/authority: artifact files, gallery manifest, versions, state/DB/datasource config and
  user filesystem permission.
- Untrusted input/threats: slugs/paths may traverse, symlinks or concurrent processes may race,
  partial writes may corrupt state, and private local files may enter a deploy tree.
- Controls/tests: bounded validated slugs, contained paths, atomic artifact writes, stale-hash
  refusal, state directories excluded from deploy copies, and path/manifest/publisher tests.
- Residual risk: locking is process-local, lifecycle transactions are not fully crash-safe,
  symlink/adversarial filesystem coverage is incomplete, and local deletion is multi-surface.

## Loopback service

- Assets/authority: local HTTP API, artifacts, comments/decisions/DB, registered datasource
  commands and the user running the process.
- Untrusted input/threats: hostile local/web requests, traversal, oversized/malformed bodies,
  cross-origin access, command misuse, denial of service, or exposure beyond the machine.
- Controls/tests: binds 127.0.0.1, validates routes/body shapes and datasource allowlist,
  blocks traversal, keeps shell datasources out of hosted Worker, and tests malformed routes.
- Residual risk: no authentication, quota or multi-process CAS; any process/user able to reach
  loopback may act with the server user's local authority. It is not a LAN/team service.

## Deployment adapters

- Assets/authority: destination name/repository, local artifact tree, `gh`/Wrangler authority
  and provider account.
- Untrusted input/threats: target confusion, credential leakage, staging private state,
  command/output spoofing, partial publish, or accidental audience expansion.
- Controls/tests: explicit target selection/config, final artifact scanning, fixed argument
  arrays, state-directory exclusion, scoped Worker KV names, and staged-deploy unit tests.
- Residual risk: provider CLIs/settings and account permissions are external; confirmation and
  dry-run semantics are incomplete and provider rollback/deletion are not transactional.

## Public static targets

- Assets/authority: public artifact bytes, repository/history/CDN and user-controlled audience.
- Untrusted input/threats: permanent private-data disclosure, malicious content, lost
  attribution, cache/fork persistence, abuse and ambiguous target visibility.
- Controls/tests: public target is explicit, secret scan precedes deploy, GitHub state dirs are
  excluded, and policies disclose operator/removal limitations.
- Residual risk: scanners miss sensitive content, global deletion is impossible, and public
  consumers can copy bytes. GitHub Pages has no mutable state channel.

## Hosted content and control plane

- Assets/authority: Cloudflare Worker/static assets, KV namespace, routes/config, user account.
- Untrusted input/threats: cross-worker state collision, exposed origin, provider compromise,
  stale edge data, quota exhaustion, and state loss.
- Controls/tests: worker-scoped KV namespace naming, API validation, hosted datasource refusal,
  and Worker handler/publisher tests. Availability is partial.
- Residual risk: KV is eventually consistent, writes lack CAS, quotas/backup/restore and origin
  fail-closed behavior are not production-verified. The account owner is the operator.

## Audience and identity

- Assets/authority: future audience policy, viewer identity/roles, sessions and revocation.
- Untrusted input/threats: forged identity headers, stale access, confused deputy, privilege
  escalation, public-origin bypass and audit gaps.
- Controls/tests: none shipped. Manual Cloudflare Access may front a user deployment but the
  package does not configure, verify, consume or authorize identity.
- Residual risk: entire boundary is planned; authenticated collaboration claims are refused.

## Mutable collaboration state

- Assets/authority: decisions, comments, mini-DB documents, current artifact revision and KV/
  local filesystem writer.
- Untrusted input/threats: lost updates, stale writes, malformed documents, cross-artifact
  access, replay, quota exhaustion and missing audit history.
- Controls/tests: bounded route identifiers and shapes, stale artifact publish guard, separated
  local/Worker handlers, and state/DB tests. Availability is partial.
- Residual risk: no cross-process/hosted CAS, identity, audit, reconnect guarantee, quota model
  or durable backup/restore gate.

## Viewer-scoped connectors

- Assets/authority: future viewer grants, provider credentials, query/results, cache and audit.
- Untrusted input/threats: cross-viewer data leak, overbroad grant, prompt/query injection,
  retry side effects, stale cache, provider outage and credential exposure.
- Controls/tests: no hosted viewer connector exists; local datasources are fixed commands and
  are refused by the Worker.
- Residual risk: entire boundary is planned; connector capability claims are refused.
