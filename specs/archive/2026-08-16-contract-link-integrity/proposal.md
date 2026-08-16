# Proposal: Validate documentation links and anchors

## Outcome

Repository validation detects broken local documentation targets, missing Markdown heading
anchors, and unavailable authoritative-source URLs before a contract or release claim is
accepted.

## Context

Phase 0 currently relies on prose links among the README, product contract, roadmap,
traceability matrix, component and hosting documentation, evidence, and official product
documentation. The existing `readme-links` assertion checks only whether a subset of README
paths exist; it does not validate anchors, links elsewhere in the contract, or official URLs.
A broken or redirected source can therefore leave capability language apparently supported
when its evidence path is not executable.

## Scope

- In scope: a dependency-free Markdown link extractor; deterministic validation of relative
  file links and GitHub-style heading fragments under `README.md`, `docs/`, and `specs/`;
  explicit classification of authoritative external URLs; a network-enabled official-link
  command with bounded timeouts and visible failures; unit fixtures for encoding, duplicate
  headings, non-file schemes, fragments, and ignored literal/code content; CI/structural
  integration that cannot claim an external result when network checking was skipped.
- Out of scope: crawling arbitrary third-party sites, checking image pixel content, proving
  that linked prose semantically supports a claim, rewriting links automatically, or treating
  transient network failures as evidence that local contract structure is invalid.

## Risks and rollback

- Risk: Markdown parsing differences can create false positives; heading-slug emulation can
  diverge from GitHub; external hosts can rate-limit or fail transiently; an unbounded crawler
  could make deterministic checks slow or network-dependent.
- Rollback: keep local target/anchor validation as the deterministic repository check and
  remove the network command/CI step if it proves unreliable. No artifact or user data is
  migrated, and failure does not mutate documentation.

## Validation plan

Validate the proposal with the Phase 0 contract owners by showing that the command reports
the exact source path, line, target, and failure class and that skipped external checks remain
visible. Verify with table-driven tests containing good and broken local paths/anchors plus a
fake HTTP probe for success, redirect, timeout, and terminal failure. Retain one dated real
official-source run for Phase 0 rather than making live network state part of `npm test`.
