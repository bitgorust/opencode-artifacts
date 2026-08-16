# Specification delta: Expose complete artifact lifecycle operations

## MODIFIED

### Requirement: LIFE-03

Stable paths and registered URLs resolve to the selected head revision. Restoring an earlier
revision creates one new auditable head revision with restored-from provenance and preserves
all prior history.

#### Scenario: Normal behavior

- **Given:** artifact revision 3 and retained revision 1
- **When:** revision 1 is restored against expected head 3
- **Then:** revision 4 becomes head with revision-1 bytes and explicit restore provenance

#### Scenario: Failure or refusal

- **Given:** the expected head changed or requested revision is absent
- **When:** restore is attempted
- **Then:** it refuses without moving the head or changing history

#### Scenario: Relevant boundary

- **Given:** an old path or URL is not a registered reference
- **When:** resolution is attempted
- **Then:** it is not guessed from title or similar slug

### Requirement: LIFE-05

Update resolves an exact ID, contained path, registered URL, or deprecated exact slug and
accepts expected revision/hash. A stale refusal carries bounded current identity, head,
metadata, and merge content or an immutable pinned content reference for the same session.

#### Scenario: Normal behavior

- **Given:** an exact artifact reference and matching expected revision
- **When:** update commits
- **Then:** one new revision is selected under the same opaque identity

#### Scenario: Failure or refusal

- **Given:** the expected revision/hash is stale
- **When:** update is attempted
- **Then:** no bytes change and the bounded result identifies current merge input and retry token

#### Scenario: Relevant boundary

- **Given:** a title-derived slug already exists but no artifact/precondition was supplied
- **When:** legacy-style publish runs
- **Then:** it returns a conflict instead of overwriting the existing artifact

### Requirement: LIFE-06

CLI and plugin expose list, read/status, restore, archive/unarchive, export, and import with
consistent identities/results. Archive is previewed, explicitly confirmed, transactional, and
recoverable; irreversible delete is unavailable.

#### Scenario: Normal behavior

- **Given:** an active artifact with history and local state
- **When:** archive is previewed and confirmed with its current token
- **Then:** it leaves active listings while all data remains recoverable by opaque ID

#### Scenario: Failure or refusal

- **Given:** confirmation is missing, stale, or scoped to another artifact/head
- **When:** archive is requested
- **Then:** it refuses and reports that the artifact remains active

#### Scenario: Relevant boundary

- **Given:** an archived artifact's slug is now used by another active artifact
- **When:** unarchive is requested
- **Then:** it requires an explicit non-conflicting slug and preserves both identities

### Requirement: UX-01

Documented CLI/plugin create, revise, read, restore, export, archive, and unarchive paths show
artifact ID, slug, head revision/hash, visibility, and target capability at each decision.

#### Scenario: Normal behavior

- **Given:** a user requests artifact status
- **When:** CLI or plugin returns it
- **Then:** the same identity, head, visibility, capability, and deployment references appear

#### Scenario: Failure or refusal

- **Given:** a reference resolves no artifact
- **When:** a lifecycle operation runs
- **Then:** output explains accepted reference forms and makes no mutation

#### Scenario: Relevant boundary

- **Given:** a local artifact also has public-static deployment references
- **When:** status is shown
- **Then:** local and public-static capabilities are distinguished rather than labeled private/live

### Requirement: UX-02

Empty, stale, validation, quota, denied, archived, incompatible, and partial-recovery lifecycle
states say what happened, what remained unchanged, and the next safe action in bounded output.

#### Scenario: Normal behavior

- **Given:** a stale update
- **When:** the refusal is displayed
- **Then:** it identifies unchanged current head and gives merge/retry information

#### Scenario: Failure or refusal

- **Given:** a corrupt bundle or store cannot be safely read
- **When:** an operation is requested
- **Then:** it does not present empty success and points to bounded repair/status output

#### Scenario: Relevant boundary

- **Given:** recovery completed with exclusions
- **When:** status is displayed
- **Then:** exclusions remain visible beside the usable selected state

### Requirement: UX-04

Archive previews exact artifact/head, state/revision scope, bytes, deployment references, and
recovery behavior; execution requires a one-use confirmation bound to that scope. Irreversible
local deletion remains unavailable.

#### Scenario: Normal behavior

- **Given:** a current archive preview
- **When:** its exact token is confirmed
- **Then:** only the named artifact/head and associated local data are archived recoverably

#### Scenario: Failure or refusal

- **Given:** scope changed after preview
- **When:** the old token is submitted
- **Then:** archive refuses and requires a new preview

#### Scenario: Relevant boundary

- **Given:** deployment references point to external retained copies
- **When:** local archive is previewed
- **Then:** output states those external copies are not deleted

### Requirement: UX-06

Export produces a documented schema-versioned checksummed directory bundle with portable page,
metadata, all revisions, sources when available, comments, decisions, and supported documents.
Import validates the entire bundle before atomic mutation and reports unsupported content.

#### Scenario: Normal behavior

- **Given:** a representable artifact bundle
- **When:** export then import completes
- **Then:** identity, revisions, selected head, metadata, state, and documents round-trip

#### Scenario: Failure or refusal

- **Given:** a corrupt, oversized, escaping, or future-schema bundle
- **When:** import preflight runs
- **Then:** it fails without creating or modifying an artifact

#### Scenario: Relevant boundary

- **Given:** an export contains authoring source or local mutable state
- **When:** public deployment staging runs
- **Then:** those internal bundle/store areas remain excluded unless separately authorized

### Requirement: SEC-02

Lifecycle references, paths, URLs, bundle entries, metadata, confirmation tokens, operation
IDs, and results are validated and bounded before authority or filesystem access; resolved
paths remain within the intended root and ambiguous references fail closed.

#### Scenario: Normal behavior

- **Given:** a valid contained path or registered URL
- **When:** it resolves
- **Then:** exactly one artifact ID is returned within configured result limits

#### Scenario: Failure or refusal

- **Given:** encoded traversal, symlink escape, unsupported scheme, duplicate match, or foreign URL
- **When:** resolution/import is attempted
- **Then:** it is rejected before reading or writing outside the artifact root

#### Scenario: Relevant boundary

- **Given:** a stale payload refers to a large immutable source
- **When:** it is returned
- **Then:** inline output remains bounded and the pinned path cannot escape or change revisions

### Requirement: COMPAT-05

Lifecycle CLI/tool arguments and versioned result/bundle schemas follow SemVer. Existing
`version`, `expectedHash`, `latest`, `state`, restore spelling, and exact bare-slug behavior are
retained as documented compatibility aliases for at least one supported minor; removals
require notice and a migration path.

#### Scenario: Normal behavior

- **Given:** an existing supported caller uses a retained legacy spelling
- **When:** the new minor runs it
- **Then:** equivalent safe behavior occurs with bounded deprecation guidance

#### Scenario: Failure or refusal

- **Given:** a legacy update omits the precondition for an existing artifact
- **When:** compatibility handling runs
- **Then:** it refuses overwrite and explains the new safe call instead of silently weakening CAS

#### Scenario: Relevant boundary

- **Given:** `version:false` is supplied
- **When:** publication succeeds
- **Then:** immutable history is still created and the argument is reported deprecated

### Requirement: COMPAT-07

Export/import preserves every representable artifact identity, revision, timestamp/time zone,
authorship/provenance field, deployment policy/reference, comment, decision, and supported
document with checksummed validation.

#### Scenario: Normal behavior

- **Given:** an artifact containing every supported field
- **When:** it round-trips through a bundle
- **Then:** semantic equality and immutable revision hashes are preserved

#### Scenario: Failure or refusal

- **Given:** a bundle field or revision cannot be represented safely
- **When:** import validates it
- **Then:** the whole import is refused with an exact unsupported-content report

#### Scenario: Relevant boundary

- **Given:** target storage already contains the same ID with divergent history
- **When:** import preflight runs
- **Then:** it requires an explicit supported collision policy and never cross-wires histories

### Requirement: QUAL-02

Reference resolution, lifecycle operations, stale payloads, permissions, archive recovery, and
export/import have deterministic unit and CLI/plugin end-to-end tests, including compatibility
and hostile boundaries.

#### Scenario: Normal behavior

- **Given:** the lifecycle journey and bundle fixture corpus
- **When:** CLI and plugin suites run
- **Then:** every operation produces the same domain state and bounded result

#### Scenario: Failure or refusal

- **Given:** a public lifecycle path or changed argument lacks a test
- **When:** packet verification runs
- **Then:** implementation and Phase 1 acceptance fail

#### Scenario: Relevant boundary

- **Given:** OpenCode host/platform evidence is unavailable
- **When:** worktree tests pass
- **Then:** no packed-host or supported-platform claim is inferred
