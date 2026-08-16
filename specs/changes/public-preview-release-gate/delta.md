# Specification delta: Decouple public preview from certification evidence

## MODIFIED

### Requirement: OUT-02

A certified local-artifact-core or later release MUST retain a first-time-user run on every
claimed supported clean machine: install the exact released package, create an offline
artifact, and reopen it from only README instructions in at most ten minutes, without a
checkout or hosting account. A public-preview distribution MAY proceed without this baseline
only when release evidence records OUT-02 as incomplete, claims zero supported cells and no
first-use usability result, and labels every release surface uncertified. Synthetic agent
probes MAY diagnose the instructions but MUST remain test-only.

#### Scenario: Normal behavior

- **Given:** a candidate seeking certified local-artifact-core status
- **When:** its first-use evidence is evaluated
- **Then:** every claimed supported platform has an eligible passing human run against the exact package and README

#### Scenario: Failure or refusal

- **Given:** no eligible first-time-user baseline exists and the owner refuses to conduct one
- **When:** an otherwise hard-gate-clean candidate is evaluated for public preview
- **Then:** preview may proceed with OUT-02 visibly incomplete, zero support/usability claim, and no certification label

#### Scenario: Relevant boundary

- **Given:** Kimi or another automated agent completes the first-use steps
- **When:** evidence is aggregated
- **Then:** the run is labeled synthetic diagnostic evidence and contributes nothing to OUT-02 certification

### Requirement: OUT-03

A certified local-artifact-core or later release MUST retain the checked-in comprehension
baseline from at least ten consented representative primary users, with at least 90% meeting
the existing four-fact/one-minute threshold. A public-preview distribution MAY proceed without
that baseline only when OUT-03 remains incomplete, no comprehension or usability claim is
made, and automated/model probes are labeled synthetic and excluded.

#### Scenario: Normal behavior

- **Given:** at least ten eligible representative-user records for a certification candidate
- **When:** the approved corpus is scored
- **Then:** certification passes only when at least 90% identify all four facts within one minute without assistance

#### Scenario: Failure or refusal

- **Given:** the owner will not recruit participants or fewer than ten eligible records exist
- **When:** an otherwise hard-gate-clean candidate is evaluated for public preview
- **Then:** preview may proceed while OUT-03 remains visibly incomplete and no human-comprehension claim is made

#### Scenario: Relevant boundary

- **Given:** one or many model sessions answer the comprehension prompts
- **When:** preview and certification evidence are produced
- **Then:** their results may inform QA but never enter the representative-user denominator

### Requirement: OUT-04

Public preview is a non-certified distribution state that MAY precede the separately releasable
local artifact core, local collaboration, public snapshots, authenticated collaboration, and
connector-capable artifact levels. A public preview MUST NOT claim or accumulate a certified
level. Each certified level continues to require every requirement assigned to that level.

#### Scenario: Normal behavior

- **Given:** exact preview hard gates pass while certification evidence is incomplete
- **When:** source or an npm package is made public
- **Then:** it is labeled public preview, unsupported and uncertified, with missing evidence linked

#### Scenario: Failure or refusal

- **Given:** a preview candidate is described as local artifact core, supported, production-ready, or parity-certified
- **When:** release validation runs
- **Then:** publication is refused regardless of automated test success

#### Scenario: Relevant boundary

- **Given:** a later candidate seeks a certified release level
- **When:** accumulated requirements are evaluated
- **Then:** prior preview publication supplies no waiver, pass, or support evidence

### Requirement: COMPAT-01

The support matrix MUST name exact tested, unverified, unsupported, and supported Node,
OpenCode, OS, desktop-browser, and mobile-browser ranges. Certified local-artifact-core and
later levels retain the target floor of Node 24+, current and oldest-supported stable OpenCode,
current Ubuntu LTS, current and previous macOS, Windows 11, and latest-two stable
Chromium/Firefox/Safari where available. Public preview MAY have zero supported cells only when
every surface says so and exact technical observations are not promoted into support.

#### Scenario: Normal behavior

- **Given:** a certification candidate with the full dated target matrix
- **When:** compatibility is evaluated
- **Then:** only exact combined passing cells become supported and the certified claim matches them

#### Scenario: Failure or refusal

- **Given:** a public-preview candidate has one narrow technical observation and no complete cells
- **When:** preview evidence is generated
- **Then:** it records zero supported cells and keeps every target cell unverified without blocking preview publication

#### Scenario: Relevant boundary

- **Given:** a browser generation, OS, Node, or OpenCode version moves after a preview
- **When:** a later certification is considered
- **Then:** the old observation stays historical and cannot satisfy the new supported cell

### Requirement: DIST-03

Every distribution MUST use SemVer and Conventional Commits, include reviewed release notes,
state its distribution/certification status and capabilities, name migrations and known
limits, and link exact evidence. Public preview additionally MUST pass the closed hard-gate
set for tests/build/checks, final-byte secret and CSP controls, vulnerability/license/
redistribution disposition, private vulnerability intake, exact package identity, trusted
publishing, registry integrity and provenance. It MUST visibly record missing OUT-02,
OUT-03, support, parity, and production-readiness evidence. Certified releases continue to
require all evidence for their claimed level.

#### Scenario: Normal behavior

- **Given:** an authorized SemVer preview candidate whose complete hard-gate set passes
- **When:** release notes and evidence are finalized
- **Then:** the exact candidate may publish as unsupported public preview and post-publish bytes/provenance are verified

#### Scenario: Failure or refusal

- **Given:** any hard gate fails or the preview label/missing-evidence disclosure is absent
- **When:** publication is attempted
- **Then:** the workflow fails before registry mutation

#### Scenario: Relevant boundary

- **Given:** a preview is later superseded by a certification candidate
- **When:** release level is selected
- **Then:** the certification candidate re-runs its full applicable evidence and does not inherit a waiver

### Requirement: QUAL-08

Release evidence MUST state failures, exclusions, flaky-test disposition, unsupported
platforms, and uncollected human evidence as visibly as successes. Documentation and README
claims MUST be checked against the requirement set before every distribution. Missing
OUT-02/OUT-03 and support evidence is permitted only for an explicitly uncertified public
preview; it remains incomplete rather than passed or not applicable.

#### Scenario: Normal behavior

- **Given:** a public-preview evidence record with passing hard gates and missing research/matrix evidence
- **When:** claim consistency is checked
- **Then:** the record passes only if every missing result and the unsupported/uncertified status are prominent

#### Scenario: Failure or refusal

- **Given:** missing human or platform evidence is omitted, marked pass, or marked not applicable
- **When:** preview validation runs
- **Then:** the evidence and release fail

#### Scenario: Relevant boundary

- **Given:** synthetic Kimi results and exact Ubuntu technical observations are retained
- **When:** the public preview is summarized
- **Then:** they appear as diagnostics with their scope and cannot erase the missing human or target-matrix evidence
