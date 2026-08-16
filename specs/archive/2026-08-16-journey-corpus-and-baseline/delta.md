# Specification delta: Establish the journey corpus and baseline study

## MODIFIED

### Requirement: OUT-02

The Phase 0 first-use baseline MUST execute the released-package install, offline artifact
creation, and reopen journey from only README instructions on each claimed supported clean
machine. It MUST retain package identity, platform, bounded start/end timestamps, outcome,
failure point, and participant consent under a dated study identifier. Only an eligible
first-time participant completing the entire journey within ten minutes counts as a pass.

#### Scenario: Normal behavior

- **Given:** a consented eligible first-time user, claimed clean platform, and exact released package
- **When:** the user follows only the README to install, create, and reopen an offline artifact
- **Then:** the complete journey and elapsed time are retained and a time of at most ten minutes is scored pass

#### Scenario: Failure or refusal

- **Given:** the journey needs maintainer assistance, a repository checkout, hosting account, or exceeds ten minutes
- **When:** the result is scored
- **Then:** it is retained as a failure with the first failing step and is not omitted from the baseline

#### Scenario: Relevant boundary

- **Given:** a platform or package version is not identified or the participant is ineligible
- **When:** validation runs
- **Then:** the record is rejected or explicitly excluded with reason and cannot support a platform claim

### Requirement: OUT-03

The comprehension baseline MUST use the checked-in corpus with at least ten consented,
eligible representative primary users. Without maintainer assistance, each participant gets
one minute to identify purpose, primary finding/state, provenance, and next action. A pass
requires all four; Phase 0 passes only when at least 90% pass, with every result, exclusion,
non-response, and fixture assignment visible.

#### Scenario: Normal behavior

- **Given:** at least ten eligible primary-user records from the approved corpus
- **When:** all four answers and elapsed time are scored by the approved rubric
- **Then:** the report shows the denominator, every outcome, and pass only when at least 90% identify all four facts within one minute

#### Scenario: Failure or refusal

- **Given:** fewer than 90% identify all four facts, a run needs maintainer assistance, or a response exceeds one minute
- **When:** the baseline is aggregated
- **Then:** the requirement and Phase 0 remain failed with the unsuccessful outcome visible

#### Scenario: Relevant boundary

- **Given:** fewer than ten eligible participants or one required fact has no scored answer
- **When:** aggregation is requested
- **Then:** the baseline is reported incomplete and cannot round, impute, or relabel missing data as pass

### Requirement: OUT-05

Journey measurement MUST be voluntary and purpose-bound. Each retained record MUST reference
explicit consent, permit withdrawal, exclude direct identity and private artifact content,
and remain separate from product functionality. Synthetic harness fixtures MUST be labeled
test-only and MUST NOT contribute to the product baseline.

#### Scenario: Normal behavior

- **Given:** an eligible participant receives the purpose, collected fields, retention, and withdrawal terms
- **When:** they explicitly consent and complete a study task
- **Then:** a pseudonymous record is retained for that study purpose without changing product capability

#### Scenario: Failure or refusal

- **Given:** a person declines or withdraws consent
- **When:** study collection or withdrawal processing occurs
- **Then:** no new record is collected or the covered raw record is deleted while product use remains unchanged

#### Scenario: Relevant boundary

- **Given:** synthetic records exercise validator and aggregation behavior
- **When:** reports are generated
- **Then:** test-only records are unmistakably excluded from participant counts and acceptance results

### Requirement: UX-01

The checked-in corpus MUST define create, revise, review, and share journeys with purpose,
preconditions, fixture, primary path, observable success, failure prompts, and the artifact
identity/revision/visibility/capability facts shown at each decision. Later reconnect, export,
archive, and restore journeys MAY be added by their owning phases but missing later-phase
behavior MUST remain visible.

#### Scenario: Normal behavior

- **Given:** an approved corpus version and a capability that currently ships
- **When:** a participant follows a create, revise, review, or share task
- **Then:** the task names its artifact state and has an observable, consistently scored endpoint

#### Scenario: Failure or refusal

- **Given:** a task depends on behavior that is partial, missing, or unavailable on the platform
- **When:** the task is selected
- **Then:** the protocol records that state and does not supply coaching or silently substitute another workflow

#### Scenario: Relevant boundary

- **Given:** a journey belongs to a later phase such as restore or authenticated sharing
- **When:** Phase 0 corpus completeness is reported
- **Then:** its deferred status is visible and Phase 0 does not claim that later behavior ships
