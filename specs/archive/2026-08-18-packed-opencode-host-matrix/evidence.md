# Evidence: Verify packed OpenCode host compatibility

Add one section for every affected requirement ID. Link syntax is
`[@test](path)`, `[@manual](path)`, or `[@model](path)` and targets must exist before archive.
Do not hide failed or excluded results.

## Requirement: OC-01
- Validation: clean-host discovery exposes the tools a user installed.
- Verification: exact 0.15.0 candidate tarball installed into clean roots; stable 1.18.18 live
  discovery returned all five tools and their documented schemas through both entry routes.
- Result: pass on the final 69-file candidate, SHA-256
  `df778eafd2cd17b6f2674224af85767089024d326765f34c5e10bbb60307e091`.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)

## Requirement: OC-02
- Validation: both official install entry paths produce a loadable plugin.
- Verification: isolated official CLI configuration mutation and direct config-array cells
  loaded the same extracted exact tarball. Direct `.tgz` module input was retained as a failed
  assumption rather than claimed as an install route.
- Result: pass for candidate-directory and config routes; bare future registry coordinates
  remain a post-publication boundary.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)

## Requirement: OC-03
- Validation: CI tests shipped bytes rather than workspace resolution.
- Verification: CI now feeds the one `npm pack` filename into the bounded host harness and
  uploads its JSON beside the tarball.
- Result: pass in the final dated VPS rehearsal; required CI wiring is present.
- Evidence: [@test](.github/workflows/ci.yml)

## Requirement: OC-04
- Validation: compatibility claims name only identically tested host versions.
- Verification: policy and tests name 1.18.18 as both exact current stable and oldest-tested,
  execute one deduplicated cell, and narrow the SDK peer to 1.18.18.
- Result: pass; broader 1.x and V2 beta compatibility are explicitly unproved.
- Evidence: [@test](test/governance-policy.test.ts)

## Requirement: QUAL-03
- Validation: the matrix exercises the real stable host boundary users receive.
- Verification: separate empty XDG roots, exact digest/version, live health and schemas, bounded
  logs, and a byte-unchanged packed lifecycle-list smoke were recorded without inference.
- Result: pass on the exact final Goal 4 candidate without provider inference.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)
