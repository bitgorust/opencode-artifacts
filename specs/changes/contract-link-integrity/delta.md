# Specification delta: Validate documentation links and anchors

## MODIFIED

### Requirement: QUAL-08

The pre-release documentation check MUST scan Markdown contract surfaces for relative file
targets and heading anchors and MUST fail with source location and reason when one is invalid.
It MUST provide a separately invokable, bounded official-source URL check whose pass, fail,
and skipped results remain explicit; a skipped or transiently failed external check MUST NOT
be presented as a successful source validation.

#### Scenario: Normal behavior

- **Given:** contract Markdown links to existing files, valid headings, and reachable official sources
- **When:** maintainers run local and official-source link validation
- **Then:** every target is classified as passing and the report identifies the checked scope

#### Scenario: Failure or refusal

- **Given:** a Markdown link names a missing file, absent heading, or terminally unavailable official URL
- **When:** the applicable validator runs
- **Then:** it exits non-zero and reports the source file, line, target, and failure class without editing files

#### Scenario: Relevant boundary

- **Given:** external network validation is not requested or a request times out
- **When:** deterministic repository checks finish
- **Then:** local checks retain their result while external status is explicitly skipped or failed and is never recorded as pass
