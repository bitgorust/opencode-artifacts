# Evidence: Establish the canonical page-quality corpus

## Requirement: RENDER-11

- Validation: the benchmark requires eight exact, system-neutral tasks with decidable facts,
  decisions, interactions, stress cases, provenance, and hashes.
- Verification: schema, mutation, hash, fixture, path, license, fact, and renderer-preflight
  checks pass for all eight checked-in bundles.
- Result: automated corpus construction passes; independent ambiguity and neutrality review is
  still missing, so the packet remains unverified.
- Evidence: [@test](test/page-quality-corpus.test.ts) [@manual](docs/evidence/page-quality/2026-08-19-benchmark-status.md)

## Requirement: QUAL-07

- Validation: incomplete or modified generations must be excluded from any comparison.
- Verification: the manifest and validator bind task IDs, exact inputs, interactions, viewports,
  and expected hard gates; the status record retains a zero comparative denominator.
- Result: pass for the capture contract and incomplete-status disclosure; no comparative claim.
- Evidence: [@test](test/page-quality-benchmark.test.ts) [@manual](docs/evidence/page-quality/2026-08-19-benchmark-status.md)

## Requirement: DIST-07

- Validation: only permission-safe, attributable corpus material may be distributed.
- Verification: corpus validation requires provenance, license, stable hashes, and contained
  relative paths, while the repository redistribution inventory covers shipped sources.
- Result: automated inventory passes; an independent privacy and redistribution review remains
  required before this packet can be verified.
- Evidence: [@test](test/page-quality-corpus.test.ts) [@manual](docs/evidence/governance/redistribution-2026-08-16.md)
