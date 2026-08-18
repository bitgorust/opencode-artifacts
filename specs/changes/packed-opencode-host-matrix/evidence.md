# Evidence: Verify packed OpenCode host compatibility

Add one section for every affected requirement ID. Link syntax is
`[@test](path)`, `[@manual](path)`, or `[@model](path)` and targets must exist before archive.
Do not hide failed or excluded results.

## Requirement: OC-01
- Validation: clean-host discovery exposes the tools a user installed.
- Verification: planned packed stable-host discovery and schema assertions.
- Result: pending implementation.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)

## Requirement: OC-02
- Validation: both official install entry paths produce a loadable plugin.
- Verification: planned isolated CLI-install and direct-config cells.
- Result: pending implementation.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)

## Requirement: OC-03
- Validation: CI tests shipped bytes rather than workspace resolution.
- Verification: planned exact-tarball workflow and retained output.
- Result: pending implementation.
- Evidence: [@test](.github/workflows/ci.yml)

## Requirement: OC-04
- Validation: compatibility claims name only identically tested host versions.
- Verification: planned exact current/oldest resolver and policy assertions.
- Result: pending implementation.
- Evidence: [@test](test/governance-policy.test.ts)

## Requirement: QUAL-03
- Validation: the matrix exercises the real stable host boundary users receive.
- Verification: planned clean config/cache, discovery, schema, and smoke trace.
- Result: pending implementation.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)
