# Specification delta: Run the blinded page-quality benchmark

## MODIFIED

### Requirement: RENDER-12

An equal-or-better claim requires a current, authorized, same-input run of all eight frozen tasks
with at least three independent generations per system/task, all hard gates passing, and a blinded
panel of at least three eligible reviewers meeting every absolute and comparative threshold.

#### Scenario: Normal behavior
- **Given:** complete authorized captures and eligible blinded reviews
- **When:** the canonical aggregation runs
- **Then:** at least 80% pairs are OpenCode equivalent/better, no family loses a reviewer majority, and every OpenCode dimension median is at least Claude and 4/5

#### Scenario: Failure or refusal
- **Given:** any hard-gate failure, threshold miss, cherry-picked run, missing reviewer role, or unblinded pair
- **When:** claim status is computed
- **Then:** equal-or-better is refused and the full failure distribution remains visible

#### Scenario: Relevant boundary
- **Given:** a complete local corpus but absent current authorized Claude output or reviewers
- **When:** status is reported
- **Then:** the comparative claim remains blocked/unverified without substituting synthetic judgments

### Requirement: QUAL-07

The dated benchmark retains prompts, hashes, all required runs, environment and authorization
metadata, interaction traces, randomization, hard gates, pair choices, dimension distributions,
reviewer eligibility, failures, and confidence limits without exposing forbidden private content.

#### Scenario: Normal behavior
- **Given:** a benchmark run and reviewer panel
- **When:** evidence validation completes
- **Then:** every required generation and score maps exactly once to the frozen corpus and report denominator

#### Scenario: Failure or refusal
- **Given:** missing runs, duplicate scores, unverifiable settings, label leakage, or unauthorized retention
- **When:** the evidence record is checked
- **Then:** the run/panel is invalid, the issue is reported, and no claim is emitted

#### Scenario: Relevant boundary
- **Given:** reference contents cannot be committed but digest/aggregate retention is authorized
- **When:** the report is produced
- **Then:** protected content stays access-controlled while git retains sufficient authorized metadata and hashes to audit the decision
