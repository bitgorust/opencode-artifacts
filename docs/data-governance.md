# Data governance and public-sharing policy

Policy version: 1. Last reviewed: 2026-08-16.

The exact mode inventory is machine-readable in
[`governance-policy.json`](governance-policy.json). This is an engineering data-handling
policy, not a claim of legal compliance, residency, certification, backup, or service SLA.

## Default and controller boundary

Local rendering sends no project usage telemetry or analytics. No optional study or
measurement begins without affirmative informed consent, and declining does not reduce
product functionality. Explicit deployment is a capability action: fields required to push
to the user-selected GitHub or Cloudflare account cross that provider boundary and are not
quietly treated as analytics consent.

The user or organization controlling a destination repository/account operates that target.
The project does not operate GitHub Pages or Cloudflare deployments, choose their region,
promise their backups/log retention, or convert provider terms into a project guarantee.
GitHub Pages and an unprotected Worker are public. Cloudflare Access is a manual perimeter
owned by the deployer, not verified authenticated product behavior.

Authenticated collaboration and viewer-scoped connectors are planned. Their prospective
identity, role, session, grant, connector-result, cache, and audit fields are not current
collection.

## Current mode inventory

| Mode | Data and location | Retention and deletion |
|---|---|---|
| Portable local | Authored source/metadata, HTML, manifest/versions and browser localStorage on user-controlled filesystem/profile | User deletes files and browser data; user backups follow their policy |
| Loopback service | Pages, decisions, comments, mini-DB, registered datasource output in local process/project/browser | Stop process; delete `.state`, `.db`, datasource config, artifacts and browser data separately |
| GitHub Pages | Public pages/gallery, manifest, commits and repository metadata in GitHub/CDN | Operator removes content/history/repository; forks, clones, caches and backups may remain |
| Cloudflare Worker | Public pages/Worker config plus KV decisions/comments/mini-DB in user account/edge | Operator deletes Worker, KV, routes and available logs; provider cache/backup expiry is not claimed |
| Journey study | Pseudonymous consent/eligibility/platform/timing and synthetic-fixture answers in restricted raw storage | Withdrawal deletes covered raw record; all raw data deleted 30 days after aggregate acceptance |
| Release evidence | Public technical versions, digests, test results and approved fixtures/screenshots | Retained as decision history; private/unauthorized material is removed with a redacted correction |

## List, export, correction, and deletion

Local artifacts can be listed through the gallery/manifest and copied as files. Correction
creates or republishes a revision; immutable history is not silently rewritten. Delete the
artifact, version files, manifest entry/state and browser data according to scope. There is no
single current command that proves all local copies, backups, or browser storage are gone, so
complete erasure is unavailable.

For GitHub Pages, repository history/export and deletion are GitHub/operator operations. For
Cloudflare, source artifacts can be copied locally; Worker/KV list/export/delete is performed
by the account operator with provider tooling. The product does not currently return a
bounded provider-wide deletion receipt or backup-expiry time. Public URLs, git history,
forks, clones, CDN caches, search indexes, screenshots, and third-party copies can outlive
removal. Authenticated/connector list, export, correction, and deletion are not implemented.

## Evidence minimization

Logs, metrics, traces, support bundles, screenshots, fixtures, benchmarks, studies and release
records must contain only purpose-required fields, use pseudonymous identifiers, and name an
access/retention review trigger. Credentials, identity headers, private security reports,
private artifacts and unnecessary personal data must not enter portable pages, deployment
trees, browser configuration, diagnostics, exports, or public evidence. Redact or reject them
before they leave their boundary. The journey-specific consent and withdrawal contract is in
[`journeys/README.md`](journeys/README.md).

Current CLI and plugin publication scans authored content, frontmatter metadata, and title
overrides. GitHub Pages and Cloudflare deployment adapters rescan every current top-level
public file, provider target configuration, and reused clone/staging tree before provider
mutation. The explicit force override is scoped to one invocation and is not remembered.

## Public abuse, takedown, and intellectual property

The complete repository disposition is in the machine-checked
[`redistribution inventory`](redistribution-policy.md).

Before public deployment, the operator must confirm the material is intended for a public
audience, references are unambiguous, and source/assets/fonts/examples have redistribution
authority and required attribution. Private, unlicensed, ambiguously licensed, or secret
material must not be deployed.

Reports about a user-operated target should go first to the repository/account operator and
then through the relevant GitHub or Cloudflare abuse/IP process. A non-sensitive project bug
in the deployment adapter may use the public project issue tracker. The project can guide or
fix its software but cannot unilaterally remove a user's target or guarantee immediate global
removal. Operators should preserve the minimum record needed to evaluate a report, remove
validated material within their authority, avoid republishing it in the takedown record, and
state which history/caches/third-party copies may remain.
