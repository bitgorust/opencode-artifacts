# Specification delta: Make mutable artifact state atomic and bounded

## MODIFIED

### Requirement: LOCAL-04

Local decisions, comments, and mini-database stores use versioned envelopes and atomic
expected-revision mutations across clients and processes. Document, collection, thread, body,
and request-rate limits are enforced consistently through HTTP and plugin surfaces.

#### Scenario: Normal behavior

- **Given:** two clients update different documents from the same collection revision
- **When:** their operations serialize
- **Then:** both documents remain and each response reports the committed store revision

#### Scenario: Failure or refusal

- **Given:** two clients replace the same state from one expected revision
- **When:** both submit
- **Then:** one commits and one receives a bounded current value/revision without mutation

#### Scenario: Relevant boundary

- **Given:** a public-static or legacy Cloudflare KV surface
- **When:** local concurrency capability is evaluated
- **Then:** it cannot inherit the local CAS claim or accept an unsupported strong-state label

### Requirement: SEC-07

Every mutable local write is serialized and CAS-checked with bounded body, shape, count, byte,
rate, wait, retry, and response limits. Replayed operation IDs return the prior result and do
not duplicate effects.

#### Scenario: Normal behavior

- **Given:** a valid expected revision and operation ID within limits
- **When:** a mutation commits
- **Then:** exactly one new store revision is selected

#### Scenario: Failure or refusal

- **Given:** stale, oversized, malformed, rate-exceeded, or future-schema input
- **When:** mutation is attempted
- **Then:** it fails before commit and reports what remained unchanged

#### Scenario: Relevant boundary

- **Given:** a success response is lost and the operation is retried
- **When:** the same operation ID reaches the store
- **Then:** the original bounded result is returned without another revision

### Requirement: OPS-04

Stale, quota, overload, corrupt-store, timeout, cancellation, and migration states return typed
degraded results with the selected safe revision and next action. Reads continue only from a
validated last-known-safe envelope.

#### Scenario: Normal behavior

- **Given:** a stale client receives the current bounded envelope
- **When:** it merges and retries against that revision
- **Then:** the new mutation can commit without rediscovering artifact identity

#### Scenario: Failure or refusal

- **Given:** current state cannot be validated
- **When:** a read or write is requested
- **Then:** writes fail closed and reads do not present corrupt data as empty state

#### Scenario: Relevant boundary

- **Given:** the mutation rate reaches its warning threshold but not its hard limit
- **When:** another mutation succeeds
- **Then:** the response includes an actionable warning without weakening consistency

### Requirement: PERF-05

Mutable state publishes and enforces defaults for encoded bytes, answer/thread/document counts,
field sizes, collection size, mutation rate, and bounded operator override ranges with warning
thresholds before hard rejection.

#### Scenario: Normal behavior

- **Given:** a store remains below every configured hard limit
- **When:** its mutation commits
- **Then:** measured usage and remaining capacity are available in the bounded result

#### Scenario: Failure or refusal

- **Given:** final encoded state would exceed any hard limit
- **When:** mutation is evaluated
- **Then:** it is rejected without changing the existing store

#### Scenario: Relevant boundary

- **Given:** an operator requests a value above the absolute override ceiling
- **When:** configuration loads
- **Then:** startup/preflight refuses the invalid configuration

### Requirement: COMPAT-03

Decision, comment, and document stores carry integer schema versions and migrate under backup
from every released local shape. Unknown future versions fail without mutation; legacy
Cloudflare keys are mapped only through explicit provider-migration records.

#### Scenario: Normal behavior

- **Given:** a released local JSON state shape
- **When:** migration completes
- **Then:** its payload is preserved under artifact identity with revision and hash metadata

#### Scenario: Failure or refusal

- **Given:** an unknown future state schema
- **When:** the runtime opens it
- **Then:** reads/writes refuse rather than treating it as an empty store

#### Scenario: Relevant boundary

- **Given:** a historical shared-KV key cannot be assigned unambiguously
- **When:** offline mapping runs
- **Then:** it emits a repair item and performs no provider mutation

### Requirement: QUAL-02

CAS, serialization, migration, validation, and limit behavior is covered by deterministic
unit, property, multi-process, HTTP, plugin, and browser tests independent of network and
developer-specific state.

#### Scenario: Normal behavior

- **Given:** the local state fixture corpus and deterministic barriers
- **When:** the suite runs
- **Then:** every normal mutation and limit boundary matches the model

#### Scenario: Failure or refusal

- **Given:** a public mutation path bypasses the CAS store or lacks a test
- **When:** verification runs
- **Then:** the packet and Phase 1 gate fail

#### Scenario: Relevant boundary

- **Given:** provider access is unavailable
- **When:** local and fake migration tests pass
- **Then:** no real provider or hosted consistency result is claimed

### Requirement: QUAL-06

Adversarial state tests cover stale/replayed writes, malformed schemas/encodings, path names,
deep/large payloads, thread/document exhaustion, mutation-rate overload, process crash, and
cross-artifact association attempts.

#### Scenario: Normal behavior

- **Given:** the complete adversarial local-state corpus
- **When:** it executes
- **Then:** isolation, limits, atomicity, and recoverability remain intact

#### Scenario: Failure or refusal

- **Given:** a crafted artifact/store name or legacy record targets another artifact
- **When:** it is validated
- **Then:** access is refused before filesystem mutation and no foreign payload is returned

#### Scenario: Relevant boundary

- **Given:** controlled overload beyond rate and capacity limits
- **When:** excess writes arrive
- **Then:** they are rejected while existing state remains readable and bounded
