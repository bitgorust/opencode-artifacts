# Goal 5 first-use and comprehension materials

Materials version: 1

Status: frozen protocol; do not recruit until an authorized study owner and exact candidate are
recorded

## Consent script

“We are evaluating whether a first-time terminal-agent user can create and reopen an offline
artifact from the README, and whether a reader can identify a synthetic artifact's purpose,
primary finding, provenance, and next action. Participation is voluntary. We retain only a
random participant code, categorical eligibility and platform fields, bounded timing/outcome
data, your short answers about synthetic content, rubric scores, and consent/withdrawal times.
We do not collect your name, email, account ID, private repository content, telemetry, audio,
video, or screen recording. Raw JSON stays access-controlled and is deleted 30 days after the
aggregate is accepted, or immediately after a timely withdrawal. Only a non-identifying
aggregate and raw-file digest enter the repository. You may decline or withdraw without losing
product access. Do you consent?”

A decline creates no record. The facilitator records affirmative consent before exposing the
candidate, README, or timed task.

## Eligibility and conflict screen

- Uses a terminal coding agent as an individual developer.
- Has not maintained, contributed to, or reviewed this repository, its corpus, or rubric.
- Has not previously installed or used `opencode-artifacts` when assigned the first-use task.
- Has no other disclosed conflict that would bias the acceptance denominator.

Ineligible, conflicted, assisted, duplicate, synthetic, and withdrawn records remain visible as
exclusion counts and never enter the denominator.

## First-use prompt

“Using only the supplied README and this clean machine, install the exact named package,
create one offline artifact, and reopen the generated file. Tell the facilitator when the
artifact is open.”

Start timing immediately before showing the README. Stop at success, 600 seconds, repository
checkout, hosting-account use, maintainer help, or an unrecoverable failure. Do not coach or
diagnose during timing. Record the first failed step even when the run does not pass.

## Comprehension prompt

Open one assigned, hash-bound synthetic fixture and start timing when useful content is visible.
Ask exactly:

“What is this page for? What is its primary finding or current state? Where did its information
come from? What should happen next?”

Stop at 60 seconds. Record the concise answers verbatim in the private file, then score all four
fields against `docs/journeys/corpus.json`. Do not offer examples or hints.

## Acceptance and handling

Every claimed install-capable support cell needs an eligible README-only first-use pass. The
comprehension denominator requires at least ten eligible representative primary participants;
at least 90% must pass all four fields without assistance within 60 seconds. Do not round,
impute, discard failures, or treat synthetic runs as evidence. Validate private records with
`npm run study -- validate` and retain only the redacted aggregate, raw-file digest, owner,
candidate identity, exclusions, failures, and deletion disposition.
