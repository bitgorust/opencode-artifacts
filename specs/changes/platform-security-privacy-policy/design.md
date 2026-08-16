# Design: Publish platform, security, privacy, and release policy

Required for high-risk changes.

## Context and constraints

The policy must describe the repository and currently selectable modes without granting new
authority. Portable local files, local service state, GitHub Pages, and user-deployed
Cloudflare targets have different operators, storage, deletion behavior, and audience risk.
Future authenticated and connector modes remain target behavior, not shipped data flows.
The matrix must obey the target floor in `COMPAT-01` while refusing support claims without
same-change or current dated platform evidence. Supply-chain controls must bind to exact
packed bytes and preserve the existing no-new-dependency default.

## Chosen design

Create canonical `docs/support-policy.md`, `docs/security.md`, and `docs/data-governance.md`
records plus public `SECURITY.md`. The support document owns D-01 and D-06: Node 24; stable
OpenCode 1.x with the oldest-supported version equal to the current tested stable until two
versions are tested; current Ubuntu LTS, current and previous macOS, Windows 11/WSL; and the
latest two stable desktop/mobile browser generations where available. Each cell carries an
exact dated evidence link and defaults to unverified, never supported by family resemblance.

Use npm trusted publishing from the public GitHub Actions repository for registry provenance,
CycloneDX JSON from the exact lockfile/install for the SBOM, `npm audit` plus registry
signature verification, and a recorded SPDX license disposition. The current minor alone is
supported until broader staffed tests exist. Deprecations receive at least one supported
release of notice except an active exploit. Release evidence retains failures and verifies
the registry attestation after publish.

The data inventory is organized by mode and field category with purpose, controller/operator,
location/recipient, sensitivity, retention, and deletion. Local creation sends no telemetry.
User-operated public targets state provider implications and do not inherit a project SLA or
compliance claim. Evidence and study records are pseudonymous, purpose-bound, and deleted on
withdrawal according to their protocol.

## Alternatives

Rejected: declaring the product cross-platform from Node/library portability, because that is
not executed evidence. Rejected: supporting every historical minor, because no staffed host
matrix exists. Rejected: long-lived npm automation tokens when trusted publishing is
available. Rejected: a proprietary SBOM tool or new dependency, because npm emits standard
CycloneDX. Rejected: one undifferentiated privacy policy, because local, public-static, hosted,
and connector modes have different operators and data flows. Rejected: a public issue as the
only vulnerability channel, because it can disclose exploit details.

## Trust, privacy, and failure boundaries

Authored content, metadata, paths, URLs, provider output, identity headers, and connector
results remain untrusted. The threat model enumerates portable file, trusted HTML, filesystem,
loopback, deployment, public-static, hosted content/control, audience, mutable state, and
connector boundaries even when a future boundary is unavailable. Unshipped boundaries are
marked planned and cannot support a release claim.

Private vulnerability reporting must be enabled before the public policy points to it; its
current disabled state is retained as a failed prerequisite. Reports stay in GitHub Security
Advisories, not public issues. Local artifacts and state remain user-controlled; GitHub
history and provider caches/backups make public deletion non-instant and must be disclosed.
No credential, private report, raw participant identity, or private artifact enters retained
public evidence.

## Migration, rollout, and rollback

Land documents and non-mutating checks first after approval. Enable provider-side private
reporting and trusted publishing only with explicit external-state authority, verify them,
then allow their status to pass. Matrix support is promoted one cell at a time only from
dated evidence. Rollback removes a new claim but preserves the evidence and known failure;
compromise response pauses publishing, revokes affected credentials/trusted configuration,
deprecates affected package versions with safe guidance, rebuilds from a reviewed commit,
and verifies new provenance before resumption.

## Formal-method decision

- Decision: property model for release-policy status transitions; no formal proof for prose quality.
- Property and rationale: a matrix/policy claim may move from unverified or failed to supported
  only when exact dated evidence exists and all mandatory fields pass; missing, expired,
  excluded, or provider-configuration evidence can never aggregate to pass.
- Model/evidence path: dependency-free table-driven policy validator and tests to be added
  after approval; human review remains required for whether the selected scope and policy are appropriate.
