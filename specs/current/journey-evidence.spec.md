# Journey corpus and outcome evidence

## Versioned corpus

- `UX-01`: `docs/journeys/corpus.json` owns a machine-validated create/revise/review/share
  corpus, explicit decision state, synthetic comprehension fixtures, and a visible deferred
  record for reconnect/export/archive/restore. The deferred workflows keep `UX-01` partial.
- Each comprehension fixture declares synthetic provenance and an exact four-field rubric.
  Fixture pages are inputs, not participant evidence.

## Private study records

- `OUT-05`: real records require affirmative versioned consent, pseudonymous participant IDs,
  categorical eligibility/conflict data, bounded timings, exact release/platform fields, and
  withdrawal state. Unknown fields (including direct identity fields) fail validation.
- Raw answers and participant codes remain access-controlled and gitignored. Aggregation omits
  both. Synthetic, withdrawn, conflicted, nonrepresentative, and secondary records never enter
  the Phase 0 primary-user denominator.
- The approved protocol in `docs/journeys/README.md` prohibits default telemetry and specifies
  data minimization, access, withdrawal, and raw-record deletion. Declining participation does
  not affect product functionality.

## Acceptance semantics

- `OUT-02`: each platform ID claimed by a study needs at least one eligible first-time-user
  pass: exact release, README only, no checkout/account/assistance, and create/reopen in at most
  600 seconds. An untested claimed platform is `incomplete`; an observed covered miss is
  `fail`; no claimed platforms can never pass.
- `OUT-03`: at least ten eligible representative primary participants are required and every
  participant must answer all four rubric fields. A pass requires at least 90% to score all
  four true without assistance in at most 60 seconds. Fewer than ten is `incomplete`, not a
  pass or a rounded rate.
- The retained status at `docs/evidence/journeys/phase-0-baseline-status.md` records zero real
  participants. Therefore `OUT-02` and `OUT-03` remain missing and the Phase 0 gate remains
  incomplete until the approved real study is run.
