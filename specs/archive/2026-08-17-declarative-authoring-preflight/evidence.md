# Evidence: Preflight declarative authoring errors

## Requirement: RENDER-02
- Validation: authors need all actionable schema errors before publication without losing safe fallbacks.
- Verification: the golden fixture exercises frontmatter, component, Mermaid, anchor, and alert
  diagnostics through the domain, CLI, and plugin; count/byte ceilings, redaction, repeated
  asset locations, no-write refusal, visible warnings, and trusted-mode permission metadata
  are asserted directly.
- Result: passed. Reports are source ordered and stable, overflow ends with an exact omitted
  marker, CLI/plugin errors precede permission and writes, and standalone rendering retains
  escaped inline error boxes.
- Evidence: [@test](test/preflight.test.ts) [@test](test/assets.test.ts)

## Requirement: QUAL-02
- Validation: every declarative surface must share deterministic validation behavior.
- Verification: every registered component kind and invalid Vega-Lite input exercises the
  shared validator/renderer fallback; every checked-in example has zero preflight errors.
  The complete repository suite, TypeScript build, all 35 structural checks, package dry run,
  and diff whitespace check passed under Node 24 with network disabled.
- Result: passed with 192/192 tests; diagnostics compare exactly across repeated runs and the
  valid corpus remains accepted.
- Evidence: [@test](test/preflight.test.ts) [@test](test/components.test.ts) [@test](test/render.test.ts)
