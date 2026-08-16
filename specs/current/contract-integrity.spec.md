# Contract documentation integrity

## Local validation

- `QUAL-08`: `npm run check:links` scans Markdown contract surfaces under `README.md`,
  `docs/`, and non-template `specs/` records.
- Relative file and heading targets resolve from their Markdown source. Typed packet evidence
  links (`@test`, `@manual`, and `@model`) resolve from repository root according to the spec
  workflow convention.
- Missing paths, repository escapes, malformed percent encoding, and absent Markdown headings
  fail with source path, line, target, and failure class. Fenced and inline code are not links.
- The deterministic local check is registered as `docs-link-integrity` in `npm run check`.

## Official sources

- `npm run check:links -- --external` separately probes unique links on the declared official
  documentation hosts with a ten-second per-request timeout and followed redirects.
- HTTP success and redirects pass. Terminal failures, transient HTTP failures, request errors,
  and timeouts are distinguished and cause a non-zero exit.
- Omitting `--external` prints an explicit skipped result. Local validation never treats a
  skipped or failed external run as an official-source pass.
