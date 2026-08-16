# Proposal: Establish the journey corpus and baseline study

## Outcome

A checked-in, privacy-minimizing create/revise/review/share corpus and executable study
protocol produce an honest first-use and comprehension baseline from consented representative
participants, including failures and exclusions.

## Context

`OUT-02` requires a clean-machine install/create/reopen journey within ten minutes and
`OUT-03` requires at least 90% of at least ten representative primary users to identify four
page facts within one minute. No participant study exists. Existing examples and maintainer
browser QA are product fixtures, not representative-user evidence. Codex can prepare the
corpus, runner, consent/data-handling protocol, blank result records, and diagnostics, but it
cannot invent participants, consent, elapsed times, answers, or outcomes.

## Scope

- In scope: versioned create/revise/review/share tasks; neutral participant instructions;
  primary-user inclusion criteria and conflict-of-interest disclosure; consent and withdrawal
  procedure; clean-machine and one-minute protocols; machine-readable schemas; deterministic
  validation and aggregation; pseudonymous raw records; complete pass/fail/excluded reporting;
  retained dated summary; support for at least ten primary participants.
- Out of scope: recruiting or impersonating participants, collecting unnecessary names or
  private artifact content, opt-out telemetry, claiming secondary-reviewer coverage before a
  collaboration release, altering product behavior to improve the first baseline, or calling
  maintainer self-testing representative-user evidence.

## Risks and rollback

- Risk: leading prompts, cherry-picked fixtures, non-representative participants, inconsistent
  timing, or omitted failures could inflate comprehension; raw notes could retain personal or
  proprietary information; the released package may differ from the tested bytes.
- Rollback: invalidate and retain the flawed run as failed evidence, revise the protocol in a
  reapproved packet, and rerun with a new study identifier. Removing a summary never converts
  missing evidence into a pass, and participation withdrawal follows the documented deletion
  path for raw records.

## Validation plan

Before recruitment, a maintainer reviews task neutrality, consent language, representative
criteria, data minimization, timing, and scoring. The harness is verified with synthetic
records explicitly labeled as test fixtures. Validation requires real consented participants:
the OUT-02 report identifies tested package bytes/platform and all elapsed outcomes; the
OUT-03 report includes at least ten eligible primary users and reaches the specified threshold
for all four facts, with exclusions and non-responses visible. Until then, both baselines
remain missing and Phase 0 fails.
