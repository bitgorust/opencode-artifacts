# Evidence: Make cross-platform filesystem evidence optional for Goal 2

## Requirement: COMPAT-01

- Validation: the user explicitly made macOS and Windows native/WSL write-filesystem evidence
  optional for Goal 2.
- Verification: governance checks preserve every target cell and prevent unverified evidence
  from becoming a support claim; the Goal 2 record retains the unavailable cells and opt-in
  rollout boundary.
- Result: pass; Goal 2 closes narrowly while all missing platform cells remain unverified.
- Evidence: [@test](test/governance-policy.test.ts), [@manual](docs/evidence/lifecycle/goal-2-implementation-2026-08-16.md)
