# Specification delta: Preflight declarative authoring errors

## MODIFIED

### Requirement: RENDER-02

The declarative format validates frontmatter, components, tables, charts, Mermaid, anchors,
task lists, alerts, and asset declarations in one side-effect-free pass. It returns bounded,
ordered diagnostics with stable code, severity, source location, and next action, while the
standalone renderer preserves escaped inline error fallbacks.

#### Scenario: Normal behavior

- **Given:** a document with several independent authoring mistakes
- **When:** preflight runs through the CLI or plugin
- **Then:** all detectable errors are returned in source order before any artifact write

#### Scenario: Failure or refusal

- **Given:** a diagnostic would include a large or sensitive payload
- **When:** it is formatted
- **Then:** content is redacted/truncated and the error remains actionable

#### Scenario: Relevant boundary

- **Given:** diagnostics exceed the count or byte ceiling
- **When:** aggregation reaches the ceiling
- **Then:** output ends with an explicit omitted-count diagnostic rather than partial success

### Requirement: QUAL-02

Preflight and render acceptance share schemas and deterministic fixtures so no public authoring
path bypasses validation and inline fallback behavior cannot silently disagree with preflight.

#### Scenario: Normal behavior

- **Given:** the valid and invalid declarative corpus
- **When:** domain, CLI, plugin, and standalone render tests run
- **Then:** each surface reports the same codes and valid documents have no errors

#### Scenario: Failure or refusal

- **Given:** a fence kind lacks a preflight or fallback test
- **When:** verification runs
- **Then:** the packet and Phase 2 correctness gate fail

#### Scenario: Relevant boundary

- **Given:** the same input runs from different cwd paths and times
- **When:** diagnostics are compared
- **Then:** codes, order, locations, and redaction are identical
