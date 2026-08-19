# Evidence: Run the blinded page-quality benchmark

## Requirement: RENDER-12

- Validation: the equal-or-better claim requires 24 unselected outputs per system and at least
  three eligible blinded reviewers across all eight task families.
- Verification: aggregation, hard-gate, threshold, denominator, blinding, and mutation tests pass;
  the dated status reports zero authorized Claude runs, zero comparison OpenCode runs, and zero reviewers.
- Result: incomplete; equal-or-better remains disabled without substituting generated judgments.
- Evidence: [@test](test/page-quality-benchmark.test.ts) [@manual](docs/evidence/page-quality/2026-08-19-benchmark-status.md)

## Requirement: QUAL-07

- Validation: settings, authority, retention, hashes, traces, labels, scores, and failures must map
  exactly once to the frozen corpus.
- Verification: the fail-closed validator rejects missing, duplicate, leaked, unauthorized, or
  incomplete inputs and accepts the empty external-run template only as incomplete status.
- Result: harness pass; evidence collection is not authorized and the comparative report is absent.
- Evidence: [@test](test/page-quality-benchmark.test.ts) [@manual](docs/evidence/page-quality/2026-08-19-benchmark-status.md)
