# Evidence: Separate OpenCode artifact permissions

Add one section for every affected requirement ID. Link syntax is
`[@test](path)`, `[@manual](path)`, or `[@model](path)` and targets must exist before archive.
Do not hide failed or excluded results.

## Requirement: UX-03
- Validation: each audience/datasource/side-effect boundary is separately understandable.
- Verification: planned transition model plus denial/no-mutation integration tests.
- Result: pending implementation.
- Evidence: [@test](test/plugin.test.ts)

## Requirement: OC-06
- Validation: stable OpenCode permission policy can control each artifact authority.
- Verification: planned packed-host allow/ask/deny/auto matrix and exact prompt trace.
- Result: pending implementation.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)
