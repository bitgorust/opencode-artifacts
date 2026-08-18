# Specification delta: Certify first-use comprehension

## MODIFIED

### Requirement: OUT-02

A local-artifact-core candidate passes first use only when at least one eligible first-time
participant on every exact claimed supported clean-machine cell installs the exact package,
creates an offline artifact, and reopens it using only the README within 600 seconds.

#### Scenario: Normal behavior
- **Given:** a claimed cell and an eligible unassisted participant
- **When:** install/create/reopen finishes within 600 seconds on the exact candidate
- **Then:** that participant supplies the cell's first-use pass

#### Scenario: Failure or refusal
- **Given:** assistance, checkout/account use, wrong bytes, timeout, or failed creation/reopen
- **When:** the result is summarized
- **Then:** it is retained as a failure/exclusion and cannot cover the cell

#### Scenario: Relevant boundary
- **Given:** one or more target claimed cells have no eligible passing participant
- **When:** certification is evaluated
- **Then:** OUT-02 is incomplete or failed and local artifact core is not certified

### Requirement: OUT-03

At least ten eligible representative primary users independently identify purpose, primary
finding/state, provenance, and next action from frozen corpus pages within 60 seconds; at least
90% must pass all four fields without assistance.

#### Scenario: Normal behavior
- **Given:** ten or more eligible complete participant records
- **When:** at least 90% pass all four rubric fields within the time limit
- **Then:** the comprehension outcome passes with exact counts and distribution

#### Scenario: Failure or refusal
- **Given:** fewer than 90% pass, an answer is missing, or assistance occurred
- **When:** aggregation runs
- **Then:** the affected record fails/excludes as specified and the result is not rounded or imputed

#### Scenario: Relevant boundary
- **Given:** fewer than ten eligible complete primary records
- **When:** status is computed
- **Then:** OUT-03 is incomplete rather than pass, fail, or not applicable

### Requirement: OUT-05

The study uses affirmative consent and minimized private records with pseudonymous codes,
bounded outcome fields, withdrawal, access control, aggregate-only git retention, and no
effect on product functionality for declining participants.

#### Scenario: Normal behavior
- **Given:** an informed participant consents before timing
- **When:** the study completes
- **Then:** the private record and anonymous aggregate follow the approved schema and retention policy

#### Scenario: Failure or refusal
- **Given:** consent is absent/withdrawn or a direct identity/private artifact appears
- **When:** validation or study operation encounters it
- **Then:** collection stops or the record is rejected/deleted without entering any denominator

#### Scenario: Relevant boundary
- **Given:** an aggregate has been accepted and the raw retention deadline arrives
- **When:** the study owner performs deletion
- **Then:** raw records are deleted while the non-identifying aggregate and digest remain

### Requirement: COMPAT-01

Every local-artifact-core support cell records exact OS, Node, OpenCode, browser/device,
candidate digest, technical scope, and human first-use result; missing or stale cells stay unverified.

#### Scenario: Normal behavior
- **Given:** the complete target support matrix
- **When:** exact technical and human evidence passes for a cell
- **Then:** only that dated exact cell may be promoted to supported

#### Scenario: Failure or refusal
- **Given:** a cell fails or combines evidence from different candidate bytes
- **When:** support status is resolved
- **Then:** it is unsupported and blocks a broader certification claim

#### Scenario: Relevant boundary
- **Given:** Goal 2 made macOS/Windows write-filesystem evidence optional for an earlier gate
- **When:** local-artifact-core certification is evaluated
- **Then:** that exception is not inherited and all cells required by COMPAT-01 remain mandatory

### Requirement: QUAL-08

The dated aggregate and support report display participant failures, exclusions, withdrawals,
missing cells, stale evidence, and uncollected evidence as prominently as successful results.

#### Scenario: Normal behavior
- **Given:** completed study and platform records
- **When:** the public aggregate is generated
- **Then:** exact denominators, passes, failures, exclusions, cells, versions, and gaps are visible

#### Scenario: Failure or refusal
- **Given:** a report omits a failure or labels missing evidence not applicable without reason
- **When:** claim validation runs
- **Then:** the report and certification decision fail

#### Scenario: Relevant boundary
- **Given:** no human study owner, participants, or platform access is available
- **When:** status is published
- **Then:** evidence remains explicitly uncollected/incomplete and no human or support claim is made
