# Specification delta: Expose bounded lifecycle results and reopen

## MODIFIED

### Requirement: UX-01

Plugin lifecycle success and failure results provide a concise model-readable summary plus a
versioned bounded metadata envelope containing the exact artifact identity, revision, path/URL,
visibility/capability, status, and next safe action where applicable.

#### Scenario: Normal behavior
- **Given:** a create, update, read, restore, archive, import/export, or reopen succeeds
- **When:** the tool returns
- **Then:** its short output and structured metadata identify the resulting artifact state

#### Scenario: Failure or refusal
- **Given:** validation, permission, stale state, missing reference, or launch fails
- **When:** the tool returns
- **Then:** it names the typed layer, unchanged state, and bounded next action without raw secrets

#### Scenario: Relevant boundary
- **Given:** content exceeds the result-envelope inline limit
- **When:** read or conflict output is returned
- **Then:** metadata remains bounded and points to exact pinned content with a truncated summary

### Requirement: LIFE-06

The stable plugin lifecycle tool adds exact-reference `reopen` to list, read/status, restore,
archive/unarchive, import, and export. A config-injected `/artifact-reopen` command uses that
operation; `latest --open` remains the standalone fallback.

#### Scenario: Normal behavior
- **Given:** an exact active ID, slug, contained path, or registered URL
- **When:** reopen is requested
- **Then:** the selected stable local path or registered URL opens and the exact identity is returned

#### Scenario: Failure or refusal
- **Given:** the reference is missing, ambiguous, archived, escaping, or unregistered
- **When:** reopen is requested
- **Then:** nothing opens and an actionable exact-reference error is returned

#### Scenario: Relevant boundary
- **Given:** the stable host cannot accept the injected prompt command
- **When:** plugin configuration loads
- **Then:** tools still load and the documented CLI fallback remains available

### Requirement: COMPAT-05

The new `reopen` operation and version-1 result envelope are additive. Existing tool IDs,
argument spellings, JSON text content, and CLI fallback remain accepted for at least the
documented deprecation window.

#### Scenario: Normal behavior
- **Given:** a caller consumes the new result metadata
- **When:** a lifecycle operation completes
- **Then:** schema version and bounded stable fields are present alongside readable output

#### Scenario: Failure or refusal
- **Given:** an implementation would remove or reinterpret an existing public field
- **When:** compatibility tests run
- **Then:** the change is refused until a migration and deprecation path exists

#### Scenario: Relevant boundary
- **Given:** an older caller ignores metadata and reads only returned text
- **When:** the same existing operation runs
- **Then:** it still receives an understandable backward-compatible summary
