# Evidence: Keep goal orchestration anchored to canonical specs

## Requirement: OUT-06

- Validation: the approved recommendation keeps the goal sequence useful without making it a competing source of requirements or gates
- Verification: the runbook defines explicit canonical precedence and links every goal to its owning roadmap, benchmark, release, or completion gate
- Result: pass
- Evidence: [@manual](docs/goal-runbook.md)

## Requirement: QUAL-01

- Validation: rejected proposals retain decision rationale without entering current shipped truth or satisfying delivery gates
- Verification: deterministic tests cover valid withdrawal, missing actor/reason, verified refusal, archive disposition, and legacy schema-one normalization
- Result: pass
- Evidence: [@test](test/spec-workflow.test.ts)
