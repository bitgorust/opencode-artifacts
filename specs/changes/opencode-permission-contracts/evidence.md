# Evidence: Separate OpenCode artifact permissions

Add one section for every affected requirement ID. Link syntax is
`[@test](path)`, `[@manual](path)`, or `[@model](path)` and targets must exist before archive.
Do not hide failed or excluded results.

## Requirement: UX-03
- Validation: each audience/datasource/side-effect boundary is separately understandable.
- Verification: the bounded model exhausts requested-scope subsets and denial positions;
  integration tests deny each live `ctx.ask` transition and assert no artifact/datasource file.
- Result: pass; elevated grants have empty remembered scope and prompt metadata excludes
  content, arguments, and full executable paths.
- Evidence: [@model](test/model/opencode-permission-model.ts), [@test](test/plugin.test.ts)

## Requirement: OC-06
- Validation: stable OpenCode permission policy can control each artifact authority.
- Verification: stable 1.18.18 retained the four named rules and explicit deploy/audience deny
  beneath wildcard auto allow; CI repeats this on packed config discovery. Injected asks prove
  enforcement because provider-selected native execution is excluded from this gate.
- Result: pass for stable policy parsing, precedence model, and plugin enforcement without a
  real deployment or provider call.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)
