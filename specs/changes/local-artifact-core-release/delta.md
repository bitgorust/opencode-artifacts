# Specification delta: Certify the local artifact core release

## MODIFIED

### Requirement: OUT-04

Local artifact core is a certified level only when one immutable candidate passes accumulated
Phases 0-3 and every applicable recurring gate; public-preview evidence grants no waiver.

#### Scenario: Normal behavior
- **Given:** a candidate with every applicable requirement passing on identical bytes
- **When:** accountable owners sign the release decision
- **Then:** the candidate may be labeled local artifact core

#### Scenario: Failure or refusal
- **Given:** any required phase, evidence row, or external prerequisite fails or is missing
- **When:** the decision is evaluated
- **Then:** certification is refused without mutating a registry or provider

#### Scenario: Relevant boundary
- **Given:** an earlier public preview has valid attestations
- **When:** a new certification candidate is assessed
- **Then:** only candidate-applicable evidence is reused and byte-bound gates rerun

### Requirement: COMPAT-01

The certified candidate passes the exact target Node, OpenCode, OS, desktop-browser, and mobile-
browser support matrix; diagnostic observations and unverified cells do not become support.

#### Scenario: Normal behavior
- **Given:** exact current target versions resolved on the test date
- **When:** clean candidate runs and first-use evidence pass every required cell
- **Then:** the release record names those supported cells and triggers for revalidation

#### Scenario: Failure or refusal
- **Given:** a target cell is missing, stale, failed, or tied to different bytes
- **When:** certification is computed
- **Then:** the support gate and local-core decision fail

#### Scenario: Relevant boundary
- **Given:** current/previous or latest-two labels advance before release
- **When:** the candidate is finalized
- **Then:** labels are resolved again to exact versions and affected cells rerun

### Requirement: DIST-03

The candidate has aligned SemVer/tag intent, Conventional Commit history, checked release notes,
migrations, limits/failures, capability/certification label, and exact linked evidence before any release mutation.

#### Scenario: Normal behavior
- **Given:** a complete certified candidate record
- **When:** claim consistency is checked
- **Then:** package, README, support, privacy, migration, and release surfaces agree on local artifact core

#### Scenario: Failure or refusal
- **Given:** claims conflict, notes/evidence are incomplete, or the candidate version is inconsistent
- **When:** the release gate runs
- **Then:** release and certification are refused with the mismatch identified

#### Scenario: Relevant boundary
- **Given:** the candidate passes locally but no explicit tag/publish authority exists
- **When:** verification completes
- **Then:** the decision may be retained but no tag, npm publish, or provider mutation occurs

### Requirement: DIST-04

SBOM, audit, license, integrity, signature/provenance inputs, and consumer verification records
bind to the exact packed candidate; post-publication claims require a separately authorized registry readback.

#### Scenario: Normal behavior
- **Given:** one packed candidate
- **When:** supply-chain gates run
- **Then:** its digest binds package inventory, SBOM, audit, licenses, source commit, workflow, and expected provenance

#### Scenario: Failure or refusal
- **Given:** a vulnerability/policy failure, incompatible license, digest mismatch, or missing artifact
- **When:** the gate evaluates
- **Then:** release is blocked and the failure is retained

#### Scenario: Relevant boundary
- **Given:** no publication is authorized
- **When:** candidate certification evidence is assembled
- **Then:** provider-derived signature/provenance readback remains pending and cannot be fabricated from local inputs

### Requirement: QUAL-08

The release record resolves every applicable requirement and exposes failures, exclusions,
flaky dispositions, unsupported platforms, uncollected humans, owners, rollback, and residual risks.

#### Scenario: Normal behavior
- **Given:** the accumulated requirements matrix and candidate evidence
- **When:** deterministic release validation runs
- **Then:** every row has pass/fail/not-applicable with reason, exact evidence, date, owner, and byte applicability

#### Scenario: Failure or refusal
- **Given:** a silent row, unjustified not-applicable, stale/mismatched evidence, or unresolved blocker
- **When:** the decision is computed
- **Then:** certification fails closed and the missing obligation is visible

#### Scenario: Relevant boundary
- **Given:** implementation passes but external human, platform, reviewer, or provider evidence is unavailable
- **When:** Goal 5 reaches its gate
- **Then:** the packet remains blocked/unverified and the release claim stays at its prior level
