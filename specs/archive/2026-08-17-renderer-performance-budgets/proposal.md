# Proposal: Enforce renderer performance budgets

## Outcome

A reproducible harness reports render and browser percentiles for no-runtime, one-chart, and
multi-runtime fixtures and fails when the documented time or final-byte budgets regress.

## Context

The project enforces a final byte cap but lacks a versioned reference environment, warm/cold
method, noise policy, percentile samples, useful-content/interaction marks, and regression
gate for the Phase 2 workload classes.

## Scope

- In scope: synthetic stable fixtures, two-core/4 GiB reference profile, render p50/p95,
  browser useful-content and keyboard-interactive marks, desktop/mobile separation, final-byte
  budgets, sample metadata, noise handling, and machine-readable reports.
- Out of scope: provider/network latency, hosted load/soak, connector cost, or performance
  claims on unavailable target platforms.

## Risks and rollback

- Risk: noisy CI or hidden cache state can create false passes/failures and encourage fixture-
  specific optimization.
- Rollback: preserve reports, mark the environment non-comparable, and block the performance
  claim rather than weakening budgets or deleting a failing fixture.

## Validation plan

Repeated cold/warm runs must report environment and variance, meet PERF-02/PERF-03 p95 limits,
stay under final byte caps, and fail deterministically for injected regressions.
