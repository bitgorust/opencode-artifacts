# Phase 0 journey corpus and study protocol

Status: approved protocol; participant baseline not yet run

The candidate-bound owner/recruitment handoff is ordered in the Goal 5
[external-evidence execution kit](../evidence/page-quality/goal-5-external-evidence-kit-2026-08-19.md).

This directory owns the versioned create/revise/review/share corpus and the Phase 0 protocols
for `OUT-02`, `OUT-03`, `OUT-05`, and `UX-01`. It does not contain participant identities or
claim a result before a consented study is complete.

## Corpus

`corpus.json` is the machine-readable index. `study.schema.json` defines the strict private
record shape and `records.template.json` is a blank instance. The four comprehension fixtures under
`fixtures/` contain only synthetic project content and explicit provenance. Participant-facing
instructions name the task but never reveal the scoring rubric.

The workflow corpus covers:

1. first-use create/reopen from a released package and only README instructions;
2. create a local artifact and identify its stable path and current capability;
3. revise by the returned reference/hash, retaining a refusal as a visible outcome;
4. review a page and bring a finding or decision back to the session; and
5. share only after selecting a target and acknowledging its actual visibility.

Reconnect, export, archive, and restore remain later-phase or partial journeys. Their absence
is visible in `corpus.json`; Phase 0 does not claim those target workflows ship.

## Participant criteria

A representative primary participant is an individual developer who uses a terminal coding
agent and has not maintained or contributed to this repository. Record prior OpenCode and
artifact-tool familiarity categorically. For the `OUT-02` first-use task, the participant must
also never have installed or used `opencode-artifacts` before the timed run.

Maintainers, contributors, people who reviewed the corpus/rubrics, assisted runs, and duplicate
participants do not enter the acceptance denominator. They remain visible as exclusions in
the private raw record and aggregate counts.

## Consent and data handling

Before a run, tell the participant:

- purpose: evaluate first-use and page comprehension for Phase 0;
- collected data: a random participant code, categorical eligibility/conflict fields, declared
  platform/tool versions, bounded timestamps/durations, answers about synthetic fixtures,
  rubric scores, assistance/failure state, and consent/withdrawal timestamps;
- not collected: name, email, account identifier, private repository or artifact content,
  telemetry, audio, video, screen recording, or unrelated behavior;
- location/access: raw JSON remains in an access-controlled maintainer study directory and is
  never committed; only a non-identifying aggregate report and raw-file digest are retained;
- retention: raw records are deleted 30 days after the aggregate is accepted, or immediately
  on withdrawal before that deletion date; the anonymous aggregate remains as decision history;
- participation is voluntary, declining or withdrawing does not affect product functionality.

Record affirmative consent before timing. A declined participant produces no retained record.
The template and synthetic tests are never participant evidence.

## Prepare the exact pages

From a clean supported machine, install the exact release candidate named in the study record.
Render each assigned source without modifying it:

```text
opencode-artifacts render docs/journeys/fixtures/incident.md -o /tmp/journey-incident.html
```

Record the SHA-256 of the resulting HTML as `artifactSha256`. A participant receives one
fixture, balanced across the corpus as evenly as recruitment permits.

## OUT-02 first-use protocol

1. Confirm the machine is clean for the package and no repository checkout is available.
2. Start timing immediately before showing the README.
3. The participant may use only README instructions. Do not coach or diagnose during timing.
4. Success requires installing the exact released package, creating one offline artifact, and
   reopening that file without a hosting account in at most 600 seconds.
5. Stop at success, ten minutes, assistance, repository use, or an unrecoverable failure.
6. Record every result, including the first failure step. Each platform claimed supported in
   the study header needs at least one eligible passing first-use record.

## OUT-03 comprehension protocol

1. Open the assigned rendered fixture and start timing once useful content is visible.
2. Ask, without examples or coaching: “What is this page for? What is its primary finding or
   current state? Where did its information come from? What should happen next?”
3. Stop at 60 seconds. Record the exact concise answers about the synthetic fixture.
4. Score each field against the fixture rubric in `corpus.json`. All four fields, no assistance,
   and no more than 60 seconds are required for a participant pass.
5. At least ten eligible representative primary participants are required. At least 90% must
   pass; do not round, impute missing answers, or remove failures.

## Validate and summarize

Keep raw files under `docs/evidence/journeys/raw/` (gitignored):

```text
npm run study -- validate docs/evidence/journeys/raw/phase-0.json
npm run study -- summarize docs/evidence/journeys/raw/phase-0.json
```

Validation rejects direct-identity fields, absent consent, unknown fixtures, malformed hashes,
duplicate participants, inconsistent timing, and incomplete answers/scores. Summary output
contains no participant IDs or answer text. Retain the command output, raw-file SHA-256,
corpus/release identifiers, all failure/exclusion counts, and the access-controlled raw-evidence
owner in the dated aggregate report.
