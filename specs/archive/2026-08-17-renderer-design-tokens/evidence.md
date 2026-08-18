# Evidence: Add bounded renderer design tokens

## Requirement: RENDER-07
- Validation: project/prompt visual choices need safe deterministic precedence.
- Verification: shared resolver tests cover prompt > project > theme > default precedence,
  per-token provenance, atomic fallback, contrast, property-order-independent CSS, project
  discovery boundaries, and real plugin/CLI output. The checked-in fixture was rendered
  offline in Chromium 151 at desktop and narrow widths.
- Result: passed. Both real surfaces computed the exact authored palette/type/radius, retained
  prompt provenance and the unchanged CSP, had no horizontal overflow or console entries, and
  attempted zero HTTP(S) requests.
- Evidence: [@test](test/design-tokens.test.ts) [@manual](docs/evidence/renderer/goal-3-design-tokens-2026-08-17.md)

## Requirement: SEC-04
- Validation: token configuration must not become raw CSS or an executable Markdown escape hatch.
- Verification: hostile color/font/spacing/radius/density values, unknown keys, low contrast,
  exact 8 KiB/overflow, file and parent symlinks, duplicate declarations, and invalid-project
  plugin no-permission/no-write behavior are asserted. Full Node 24 gates passed: 202/202
  tests, TypeScript build, all 35 structural checks, package dry run, and diff whitespace.
- Result: passed. Invalid sources never apply partially or enter generated CSS; only fixed
  variables with parser-owned serializations are emitted, and trusted HTML remains separate.
- Evidence: [@test](test/design-tokens.test.ts) [@test](test/governance-policy.test.ts) [@manual](docs/security.md)
