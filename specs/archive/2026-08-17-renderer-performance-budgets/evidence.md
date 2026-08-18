# Evidence: Enforce renderer performance budgets

## Requirement: PERF-01
- Validation: comparable percentile claims require a versioned environment, corpus, and noise method.
- Verification: planned deterministic harness/report schema and non-comparable environment tests.
- Result: version-1 config/fixtures, exact hashes, cold/warm state, nearest-rank distributions,
  explicit noise policy, excluded setup, contributions, and comparable environment metadata retained.
- Evidence: [@test](test/performance.test.ts) [@manual](docs/evidence/renderer/goal-3-performance-2026-08-17.md)

## Requirement: PERF-02
- Validation: CLI p95 budgets are already normative Phase 2 limits.
- Verification: planned cold/warm no-runtime and multi-runtime reference-profile samples.
- Result: comparable 12-sample CLI distributions passed; p95 was 851ms no-runtime and 964ms
  multi-runtime against 2,000ms and 5,000ms limits.
- Evidence: [@test](test/performance.test.ts) [@manual](docs/evidence/renderer/goal-3-performance-cli-2026-08-17.json)

## Requirement: PERF-03
- Validation: useful-content and keyboard readiness budgets are part of portable-page correctness.
- Verification: planned real-browser desktop/mobile samples including runtime errors and request checks.
- Result: all six seven-sample desktop/mobile cells passed; useful-content p95 ranged from
  804ms to 2,392ms and keyboard-additional p95 from 112ms to 299ms, with zero hard failures.
- Evidence: [@test](test/performance.test.ts) [@manual](docs/evidence/renderer/goal-3-performance-browser-2026-08-17.json)

## Requirement: PERF-05
- Validation: workload byte budgets and contribution breakdown prevent silent bundle regressions below the absolute cap.
- Verification: planned warning/hard threshold, final-byte, and no-selected-oversize tests.
- Result: workload warnings/hard limits and contribution breakdowns are versioned; current
  pages are 39,902, 622,105, and 5,311,264 bytes and all remain below warning thresholds.
- Evidence: [@test](test/performance.test.ts) [@manual](docs/evidence/renderer/goal-3-performance-2026-08-17.md)
