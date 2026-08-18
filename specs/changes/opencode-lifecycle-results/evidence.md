# Evidence: Expose bounded lifecycle results and reopen

Add one section for every affected requirement ID. Link syntax is
`[@test](path)`, `[@manual](path)`, or `[@model](path)` and targets must exist before archive.
Do not hide failed or excluded results.

## Requirement: UX-01
- Validation: users and models see exact identity, revision, capability, and next action.
- Verification: fixed output/metadata byte limits, publish/lifecycle schema-1 envelopes, typed
  refusals, exact immutable read paths, and legacy string conversion are contract-tested.
- Result: implementation pass; final packed-host command observation remains pending.
- Evidence: [@test](test/plugin.test.ts)

## Requirement: LIFE-06
- Validation: reopen joins the existing list/read/status/archive lifecycle surface.
- Verification: injected launchers receive exact local paths and registered URLs; invalid
  references and launch failures invoke no accepted launcher. CLI latest/open remains tested.
- Result: pass in plugin and CLI integration tests; packed stable-host observation pending.
- Evidence: [@test](test/artifact-lifecycle.test.ts)

## Requirement: COMPAT-05
- Validation: old callers retain accepted arguments and actionable deprecation output.
- Verification: old operations/arguments still execute, prior JSON/text remains in `output` and
  `String(result)`, while packed schema assertions now require additive `reopen`.
- Result: implementation pass; final candidate schema snapshot pending.
- Evidence: [@test](test/plugin.test.ts)
