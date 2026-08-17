# Specification delta: Enforce renderer performance budgets

## MODIFIED

### Requirement: PERF-01

The repository keeps a reproducible versioned harness for no-runtime, one-chart, and
multi-runtime portable pages. Reports identify fixture hashes, CPU/memory profile, browser and
Node versions, cold/warm state, sample count, percentile method, variance/noise disposition,
final bytes, and excluded setup time.

#### Scenario: Normal behavior

- **Given:** a comparable reference environment and unchanged fixture hashes
- **When:** the harness completes its configured samples
- **Then:** it emits machine-readable p50/p95, byte, useful-content, and interaction results

#### Scenario: Failure or refusal

- **Given:** samples are missing, noisy beyond policy, or environment metadata differs
- **When:** comparison is requested
- **Then:** the result is non-comparable and cannot pass the budget gate

#### Scenario: Relevant boundary

- **Given:** a cold dependency install is present
- **When:** render timing is calculated
- **Then:** install time is separately reported and never hidden inside or silently removed

### Requirement: PERF-02

On the documented two-core/4 GiB reference profile, CLI rendering p95 is at most two seconds
for the no-runtime fixture and five seconds for the multi-runtime fixture, excluding only the
separately reported first dependency install.

#### Scenario: Normal behavior

- **Given:** valid comparable samples on the reference profile
- **When:** p95 is computed
- **Then:** both fixture classes meet their documented limits

#### Scenario: Failure or refusal

- **Given:** either p95 exceeds its limit
- **When:** the Phase 2 correctness gate runs
- **Then:** the performance requirement fails with the full distribution retained

#### Scenario: Relevant boundary

- **Given:** p95 equals the exact limit
- **When:** the gate evaluates it
- **Then:** it passes while any greater result fails

### Requirement: PERF-03

On the benchmark browser profile, useful content appears within 1.5 seconds for no-runtime,
three seconds for one-runtime, and five seconds for multi-runtime pages; keyboard interaction
is ready within one additional second. Mobile-width/device results are separate and may not
exceed twice the corresponding desktop limit.

#### Scenario: Normal behavior

- **Given:** each workload in the benchmark browser
- **When:** cold navigation and keyboard readiness marks are measured
- **Then:** desktop and mobile p95 results meet their respective limits

#### Scenario: Failure or refusal

- **Given:** a runtime error, unexpected request, or missed readiness mark
- **When:** the sample completes
- **Then:** it is a hard failure rather than a discarded timing outlier

#### Scenario: Relevant boundary

- **Given:** a mobile result equals twice its desktop-class budget
- **When:** the gate evaluates it
- **Then:** it passes while any greater result fails

### Requirement: PERF-05

No-runtime, one-runtime, and multi-runtime final-page byte budgets are versioned alongside the
15 MiB absolute cap. Runtime and asset contributions are reported separately; warning and hard
thresholds are tested before Phase 2 completion.

#### Scenario: Normal behavior

- **Given:** a fixture below its warning and hard thresholds
- **When:** final bytes are written
- **Then:** total and contribution breakdown are reported with remaining capacity

#### Scenario: Failure or refusal

- **Given:** final expansion exceeds a workload hard budget or the absolute cap
- **When:** publication or benchmark validation runs
- **Then:** it fails without selecting an oversized artifact revision

#### Scenario: Relevant boundary

- **Given:** a fixture crosses only the warning threshold
- **When:** the report is emitted
- **Then:** it remains usable but carries an actionable regression warning
