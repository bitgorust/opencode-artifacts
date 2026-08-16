# Specification delta: Publish platform, security, privacy, and release policy

## MODIFIED

### Requirement: SEC-01

The repository MUST publish a dated, versioned threat model for portable pages, trusted HTML,
filesystem inputs, loopback services, deployment adapters, public-static targets, hosted
content/control planes, audience and identity changes, mutable collaboration state, and
connectors. Each boundary MUST name assets, authorities, untrusted inputs, threats, controls,
tests, residual risk, owner, and review trigger; planned boundaries MUST remain unshipped.

#### Scenario: Normal behavior

- **Given:** a release candidate uses only modeled boundaries with current mapped controls and tests
- **When:** the security maintainer reviews the threat model
- **Then:** the candidate records each applicable boundary as covered with dated evidence

#### Scenario: Failure or refusal

- **Given:** a new or changed trust boundary lacks threats, controls, owner, or adversarial tests
- **When:** release evidence is evaluated
- **Then:** the affected capability and release claim fail closed

#### Scenario: Relevant boundary

- **Given:** the model describes a future hosted or connector boundary not implemented now
- **When:** current capability status is generated
- **Then:** the boundary remains planned and cannot be cited as shipped protection

### Requirement: SEC-10

The project MUST publish `SECURITY.md` with a verified private GitHub vulnerability-reporting
path, severity rubric, response targets, disclosure coordination, current supported-version
window, credential/key-rotation steps, and compromised-release containment and recovery. If
private reporting is disabled or unreachable, documentation MUST say reporting is unavailable
and production-readiness gates MUST fail rather than direct sensitive details to public issues.

#### Scenario: Normal behavior

- **Given:** private reporting is enabled and the current minor is supported
- **When:** a reporter follows `SECURITY.md`
- **Then:** the report reaches maintainers privately and the documented triage, disclosure, and recovery process applies

#### Scenario: Failure or refusal

- **Given:** private reporting is disabled, the version is unsupported, or response ownership is absent
- **When:** a security-readiness claim is checked
- **Then:** the failure is visible and production readiness is refused

#### Scenario: Relevant boundary

- **Given:** a release credential or published version is suspected compromised
- **When:** the playbook is invoked
- **Then:** publishing pauses, affected authority is revoked or rotated, users receive bounded guidance, and replacement provenance is verified before resumption

### Requirement: PRIV-01

A versioned inventory MUST list every stored or transmitted field category for local,
public-static, authenticated, connector, journey-study, and release-evidence modes with its
purpose, controller/operator, processor/recipient, location, sensitivity, retention trigger,
and deletion path. Unavailable modes MUST describe planned fields separately from current flows.

#### Scenario: Normal behavior

- **Given:** a currently selectable capability stores or sends a field
- **When:** its inventory entry is reviewed
- **Then:** all required ownership, purpose, location, sensitivity, retention, and deletion fields are present and current

#### Scenario: Failure or refusal

- **Given:** a collected field lacks a capability-bound purpose or deletion path
- **When:** the capability or release is reviewed
- **Then:** collection and the associated claim are refused until the inventory and implementation agree

#### Scenario: Relevant boundary

- **Given:** an authenticated or connector field belongs only to an unshipped target
- **When:** the inventory is read
- **Then:** it is labeled planned and is not represented as current collection

### Requirement: PRIV-02

Local creation MUST perform no default telemetry or analytics. User-selected public, hosted,
or connector actions MAY transmit only fields required for that action after disclosure;
optional analytics or studies require informed opt-in, and refusal MUST leave product
capability unchanged.

#### Scenario: Normal behavior

- **Given:** a user renders or opens a local artifact without selecting a network capability
- **When:** the workflow completes
- **Then:** no usage or artifact telemetry leaves the machine

#### Scenario: Failure or refusal

- **Given:** optional measurement has no affirmative informed consent
- **When:** collection would begin
- **Then:** no measurement record is sent or retained and functionality remains available

#### Scenario: Relevant boundary

- **Given:** the user explicitly deploys to a named provider
- **When:** required deployment fields cross the provider boundary
- **Then:** they are disclosed and classified as capability data, not hidden analytics consent

### Requirement: PRIV-03

Credentials, tokens, grants, identity headers, security reports, and administrative secrets
MUST be excluded from portable pages, exports, browser configuration, public deployment trees,
evidence, and user-facing diagnostics. Final bytes and staged metadata MUST be scanned before
audience expansion; overrides MUST be targeted, explicit, and auditable.

#### Scenario: Normal behavior

- **Given:** a page and its staged metadata contain no detected secret material
- **When:** the final audience-bound bytes are scanned
- **Then:** publication may continue under the selected authority and the scan result is recorded

#### Scenario: Failure or refusal

- **Given:** a credential or private security detail is detected in any audience-bound field
- **When:** publish, export, evidence retention, or deployment is attempted
- **Then:** the operation fails without writing or exposing the secret

#### Scenario: Relevant boundary

- **Given:** an authorized maintainer approves a narrowly identified false-positive override
- **When:** the exact bytes are rescanned
- **Then:** only that target proceeds and the override does not become permission for another artifact, field, or audience

### Requirement: PRIV-04

Every deployment surface MUST disclose the selected target's operator/controller boundary,
known storage location, third-party recipients, residency controls, and unsupported compliance
claims before data moves. User-operated GitHub and Cloudflare targets MUST NOT imply a project-
operated service, fixed region, backup promise, or SLA.

#### Scenario: Normal behavior

- **Given:** a user selects a public-static or future hosted target
- **When:** preflight presents the data boundary
- **Then:** operator, provider, known location/recipients, and residency limitations are visible before confirmation

#### Scenario: Failure or refusal

- **Given:** operator, region, or recipient information is unknown or contradicted by provider evidence
- **When:** documentation or setup output is produced
- **Then:** it states unknown or unsupported and does not assert compliance

#### Scenario: Relevant boundary

- **Given:** the software is deployed by a user into their own provider account
- **When:** project support language is evaluated
- **Then:** the user remains the deployment operator and provider terms are not converted into project guarantees

### Requirement: PRIV-05

The policy MUST name mode-specific list, export, correction where applicable, and deletion
paths for artifact-related personal data, including derived state and provider caches/backups.
Unavailable operations MUST be labeled unavailable; deletion MUST identify exact scope,
irreversible consequences, provider/history limitations, backup expiry where known, and a
bounded completion result before it can be claimed complete.

#### Scenario: Normal behavior

- **Given:** a user controls local artifacts or a supported provider target
- **When:** they invoke a documented data-rights operation
- **Then:** the exact covered data and completion result are reported with remaining copies and expiry disclosed

#### Scenario: Failure or refusal

- **Given:** derived data, git history, provider backup, or cache cannot be deleted by the product
- **When:** deletion is requested
- **Then:** the operation reports that limitation and cannot claim complete erasure

#### Scenario: Relevant boundary

- **Given:** correction would rewrite an immutable revision
- **When:** a user requests correction
- **Then:** the policy preserves history integrity, offers a new revision or scoped removal where supported, and explains the tradeoff

### Requirement: PRIV-06

Logs, metrics, traces, support bundles, fixtures, study records, screenshots, benchmarks, and
release evidence MUST minimize content and use pseudonymous identifiers. Each evidence class
MUST have purpose, access boundary, retention or review trigger, and withdrawal/deletion rule;
private artifacts MUST NOT leave their deployment boundary without explicit authorization.

#### Scenario: Normal behavior

- **Given:** diagnostic or acceptance evidence is retained
- **When:** it crosses into the repository or a review system
- **Then:** only purpose-required fields remain, identity/content is minimized, and retention/access are recorded

#### Scenario: Failure or refusal

- **Given:** a screenshot, trace, or fixture contains private content without explicit authority
- **When:** retention is attempted
- **Then:** it is rejected or redacted before leaving the deployment boundary

#### Scenario: Relevant boundary

- **Given:** a consented study participant withdraws within the protocol's covered period
- **When:** withdrawal is processed
- **Then:** the pseudonymous raw record is deleted while aggregate history is handled exactly as disclosed

### Requirement: PRIV-07

Public-sharing policy MUST provide abuse, takedown, and intellectual-property reporting and
handling, identify the operator responsible for a user-owned target, preserve required asset
licenses/attribution, avoid publishing ambiguous/private references, and state that immediate
global removal cannot be guaranteed across git history, forks, caches, or third-party copies.

#### Scenario: Normal behavior

- **Given:** a public artifact contains redistributable attributed material
- **When:** it is published through a supported target
- **Then:** attribution remains visible and the target-specific reporting path is documented

#### Scenario: Failure or refusal

- **Given:** material is private, unlicensed, ambiguously licensed, or subject to a valid takedown
- **When:** publication or continued availability is reviewed
- **Then:** publication is refused or the operator follows the scoped takedown process and records remaining-copy limits

#### Scenario: Relevant boundary

- **Given:** the target is a repository or provider account operated by the user
- **When:** an abuse report is made to the project
- **Then:** the project identifies the responsible operator and available escalation without falsely claiming unilateral deletion authority

### Requirement: COMPAT-01

The support matrix MUST distinguish target, tested, supported, unsupported, and unverified
combinations for Node 24, current and oldest-supported stable OpenCode, current Ubuntu LTS,
current and previous macOS, Windows 11/WSL, and the latest two stable Chromium, Firefox,
Safari, Android Chrome, and iOS Safari generations where available. A cell is supported only
with exact version, date, environment, test scope, and retained result; initially one tested
stable OpenCode version MAY be both current and oldest-supported.

#### Scenario: Normal behavior

- **Given:** every claimed matrix cell has current dated host/browser evidence
- **When:** support documentation is generated
- **Then:** the exact combination and tested scope are labeled supported with an evidence link

#### Scenario: Failure or refusal

- **Given:** an OS, browser, Node, or OpenCode combination has no run or a failing run
- **When:** a release claim is checked
- **Then:** it remains unverified or unsupported and cannot inherit support from another platform

#### Scenario: Relevant boundary

- **Given:** only the current stable OpenCode release has been tested
- **When:** oldest-supported is reported
- **Then:** current and oldest-supported may be the same exact version, and no broader range is implied

### Requirement: DIST-03

Release policy MUST require SemVer, Conventional Commits, reviewed release notes, an explicit
release-level label, migrations, known limits/failures, and links to evidence for parity or
production-readiness claims. A release MUST be blocked or its claim narrowed when the evidence
does not cover the selected level.

#### Scenario: Normal behavior

- **Given:** a candidate has a SemVer tag, conventional changes, and complete evidence for one release level
- **When:** release notes are reviewed
- **Then:** they name the level, migrations, known limits, and exact evidence without broader language

#### Scenario: Failure or refusal

- **Given:** notes claim parity, support, or readiness without required evidence
- **When:** the release gate runs
- **Then:** publication is refused until the claim is removed or the evidence passes

#### Scenario: Relevant boundary

- **Given:** a security fix requires immediate removal without a normal notice period
- **When:** SemVer/deprecation impact is assessed
- **Then:** the exception, migration guidance, and security rationale are recorded without disclosing active exploit details prematurely

### Requirement: DIST-04

Release CI MUST build the exact packed bytes, emit CycloneDX JSON, record dependency
vulnerability and license disposition, publish through npm trusted publishing with provenance,
and verify registry signatures/attestation after publication. Generated metadata is evidence
of composition and origin, not proof of safety; missing or invalid output blocks the readiness claim.

#### Scenario: Normal behavior

- **Given:** an authorized public GitHub Actions release uses the exact tested package bytes
- **When:** CI publishes and performs post-publish verification
- **Then:** SBOM, audit/license results, registry integrity, and npm provenance link to the tag, commit, workflow, and package digest

#### Scenario: Failure or refusal

- **Given:** SBOM generation, audit, license policy, trusted publishing, signature, provenance, or digest verification fails
- **When:** the release gate evaluates the candidate
- **Then:** publication stops when possible and no production-readiness claim is made

#### Scenario: Relevant boundary

- **Given:** workflow configuration requests provenance but registry-side evidence has not been retrieved
- **When:** release evidence is reconciled
- **Then:** provenance remains unverified rather than passing from configuration alone

### Requirement: DIST-05

Dependencies and vendored runtimes MUST be lockfile-pinned and reviewed for SPDX license,
known vulnerabilities, page-view network behavior, CSP effect, browser weight, update owner,
and removal path. Runtime dependencies default to permissive licenses; reciprocal, source-
available, unknown, or conflicting terms require explicit legal/maintainer review before use.
Already-created portable pages MUST remain usable after package dependency removal.

#### Scenario: Normal behavior

- **Given:** the exact lockfile and packed page runtimes have complete acceptable dispositions
- **When:** dependency policy runs
- **Then:** versions, licenses, vulnerabilities, network/CSP impact, owner, and removal path are retained as pass evidence

#### Scenario: Failure or refusal

- **Given:** a dependency is unpinned, unknown-license, policy-incompatible, critically vulnerable, or adds undeclared view-time network access
- **When:** build or release review occurs
- **Then:** the candidate is blocked until removed, fixed, or explicitly reapproved under a documented policy change

#### Scenario: Relevant boundary

- **Given:** the package or a heavy runtime is removed after an artifact was created
- **When:** the existing self-contained HTML is reopened
- **Then:** the page remains viewable without the removed package or network

### Requirement: DIST-06

The supported-version policy MUST support security fixes for the current package minor only
until broader staffing and tests are approved. It MUST define deprecation notice of at least
one supported release except active exploits, end-of-life status, migration guidance,
vulnerability reporting, and the point at which unsupported versions stop receiving fixes.

#### Scenario: Normal behavior

- **Given:** a vulnerability affects the current supported minor
- **When:** maintainers triage it
- **Then:** it receives the documented response and fix/release process with coordinated guidance

#### Scenario: Failure or refusal

- **Given:** a version is outside the current supported minor
- **When:** support is requested or a claim is generated
- **Then:** it is labeled unsupported with upgrade guidance and no unstaffed fix promise

#### Scenario: Relevant boundary

- **Given:** removal closes an actively exploitable vulnerability
- **When:** normal deprecation notice would extend exposure
- **Then:** maintainers may remove immediately, document the security exception, and provide the safest feasible migration

### Requirement: DIST-07

Release evidence MUST inventory licenses and attribution for source, dependencies,
documentation, generated examples, embedded assets, fonts, and benchmark references. Only
content with documented redistribution authority MAY ship or enter a public evidence corpus;
private or ambiguous reference artifacts remain linked or privately reviewed without copying.

#### Scenario: Normal behavior

- **Given:** every shipped file and retained public reference has a compatible license or documented authority
- **When:** package and evidence contents are inspected
- **Then:** required notices/attribution ship and the inventory records the disposition

#### Scenario: Failure or refusal

- **Given:** an asset, font, example, or reference has missing, ambiguous, or incompatible redistribution terms
- **When:** packaging or evidence retention is attempted
- **Then:** it is excluded until authority is resolved and the omission remains visible

#### Scenario: Relevant boundary

- **Given:** a Claude artifact may be viewed under account permission but not redistributed
- **When:** comparative evidence is retained
- **Then:** permitted prompts/scores or private review metadata are used and the artifact itself is not committed
