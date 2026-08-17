# Proposal: Preflight declarative authoring errors

## Outcome

Authors receive one bounded, ordered preflight report containing every detectable Markdown,
frontmatter, component, chart, table, Mermaid, asset-reference, and trusted-mode error before
publication, while standalone rendering retains safe inline fallbacks.

## Context

The current renderer converts malformed component fences to inline error cards one at a time.
That resilience is useful for reading but inefficient for agent authoring and can allow a
publish attempt before the complete error set is known.

## Scope

- In scope: side-effect-free preflight, stable diagnostic codes/severity/source locations,
  bounded aggregation and truncation, CLI/plugin results, trusted-HTML disclosure, and inline
  error parity.
- Out of scope: arbitrary HTML repair, execution of component code, network validation, or
  treating warnings as silent success.

## Risks and rollback

- Risk: parser/preflight/render divergence or diagnostics echoing sensitive payloads.
- Rollback: retain inline safe fallbacks and disable the aggregate preflight surface without
  accepting invalid content.

## Validation plan

Golden multi-error fixtures must produce complete, stable, redacted diagnostics through the
domain, CLI, and plugin before writes; valid corpus pages must have zero error diagnostics.
