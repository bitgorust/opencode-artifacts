# Evidence: Validate documentation links and anchors

## Requirement: QUAL-08

- Validation: `bitgorust` approved the diagnostics, bounded network behavior, and visible
  skipped/failure semantics on 2026-08-16.
- Verification: 99 repository tests passed, including four focused link tests; `npm run check`
  passed with the registered local invariant; the live official-source run checked 27 unique
  URLs with zero failures and retained redirects.
- Result: pass.
- Evidence: [@test](test/documentation-links.test.ts),
  [@manual](docs/evidence/contract/official-links-2026-08-16.md)
