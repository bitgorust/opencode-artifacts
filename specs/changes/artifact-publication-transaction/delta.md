# Specification delta: Make artifact publication crash-safe across processes

## MODIFIED

### Requirement: LIFE-04

Create, update, restore, manifest mutation, revision retention, and gallery generation execute
under one fenced inter-process transaction. Recovery before managed access yields a complete
old or complete new logical state and never reports a mixed commit as successful.

#### Scenario: Normal behavior

- **Given:** two processes update the same expected head concurrently
- **When:** both attempt to publish
- **Then:** exactly one commits and the other receives a stale result with no partial writes

#### Scenario: Failure or refusal

- **Given:** interruption at any stage, journal, replacement, or cleanup boundary
- **When:** a new process opens the store
- **Then:** recovery selects and verifies the complete old or complete new transaction

#### Scenario: Relevant boundary

- **Given:** two processes publish different artifacts concurrently
- **When:** both complete
- **Then:** the manifest and gallery contain both commits without a lost entry

### Requirement: SEC-07

Filesystem lifecycle writes use bounded serialization with expected-head checks, fencing, and
idempotent recovery. Lock waits, staged bytes, target counts, retries, and diagnostics have
enforced limits; a retry cannot duplicate a committed revision.

#### Scenario: Normal behavior

- **Given:** a writer holds the valid fencing token and the expected head matches
- **When:** it commits within limits
- **Then:** one revision is created and the lock is released after verification

#### Scenario: Failure or refusal

- **Given:** a stale owner resumes after lock takeover
- **When:** it reaches a commit boundary
- **Then:** fencing validation refuses its commit without altering the selected state

#### Scenario: Relevant boundary

- **Given:** a caller retries after losing the success response
- **When:** recovery finds the operation already committed
- **Then:** it returns the existing commit result instead of creating another revision

### Requirement: OPS-04

Lock timeout, cancellation, process crash, corrupt stage, and interrupted cleanup produce a
typed degraded state that names what remains selected and the next safe recovery action.
Last-known safe reads continue only after integrity is verified.

#### Scenario: Normal behavior

- **Given:** cleanup was interrupted after a verified commit
- **When:** the store reopens
- **Then:** the committed state remains readable and cleanup resumes idempotently

#### Scenario: Failure or refusal

- **Given:** neither old nor staged targets can be fully verified
- **When:** recovery runs
- **Then:** mutations fail closed and diagnostics identify the bounded repair scope

#### Scenario: Relevant boundary

- **Given:** a caller cancels while waiting for another writer
- **When:** cancellation is observed
- **Then:** no transaction is started and the selected state remains unchanged

### Requirement: OPS-05

Publication transaction rollout has preflight, staged opt-in, post-commit verification, and a
tested rollback to the prior compatible store. Failed rollout never silently enables the new
commit path.

#### Scenario: Normal behavior

- **Given:** transaction preflight and platform fault tests pass
- **When:** the new path is enabled
- **Then:** post-change verification confirms the selected head, manifest, revision, and gallery

#### Scenario: Failure or refusal

- **Given:** post-change verification fails
- **When:** rollout recovery executes
- **Then:** it restores the verified last-known-good store and reports the failed candidate

#### Scenario: Relevant boundary

- **Given:** a target filesystem has not run the required fault suite
- **When:** enablement is evaluated
- **Then:** the old compatible path remains selected on that platform

### Requirement: QUAL-02

Transaction, locking, fencing, stale checks, recovery, and fault boundaries have deterministic
unit, property, multi-process, and filesystem tests that do not rely on timing luck.

#### Scenario: Normal behavior

- **Given:** deterministic worker barriers and fault indices
- **When:** the lifecycle suite runs
- **Then:** every race and write boundary produces the modeled result

#### Scenario: Failure or refusal

- **Given:** a commit boundary lacks a deterministic failure test
- **When:** packet verification runs
- **Then:** implementation and archive validation are not accepted

#### Scenario: Relevant boundary

- **Given:** the same test repeats under scheduling variation
- **When:** results are compared
- **Then:** correctness depends on explicit barriers/state, not wall-clock ordering

### Requirement: QUAL-06

Adversarial lifecycle tests cover stale/replayed writes, lock exhaustion, path/symlink attacks,
resource exhaustion, split-brain takeover, process crash, journal corruption, and recovery.

#### Scenario: Normal behavior

- **Given:** the complete adversarial transaction corpus
- **When:** it runs on a supported write platform
- **Then:** every attack is contained and a complete selected state remains

#### Scenario: Failure or refusal

- **Given:** a crafted journal or target path escapes the artifact root
- **When:** recovery validates it
- **Then:** recovery refuses the input without reading or writing outside the root

#### Scenario: Relevant boundary

- **Given:** repeated writers exceed wait or recovery limits
- **When:** overload is reached
- **Then:** excess work is rejected without corrupting existing artifacts or leaking content
