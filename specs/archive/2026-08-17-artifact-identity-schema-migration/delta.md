# Specification delta: Introduce durable artifact identity and schema migration

## MODIFIED

### Requirement: LIFE-01

Every artifact has a generated opaque ID independent of title, slug, path, content hash, and
deployment URL. A unique human-readable slug is a mutable reference; renaming it preserves the
ID, revisions, state association, and deployment references.

#### Scenario: Normal behavior

- **Given:** an existing artifact is renamed
- **When:** the new slug is committed
- **Then:** the artifact ID and history remain unchanged and the new stable path resolves to it

#### Scenario: Failure or refusal

- **Given:** a requested slug belongs to another active artifact
- **When:** rename or migration validates the change
- **Then:** it refuses without changing either artifact

#### Scenario: Relevant boundary

- **Given:** two legacy entries have the same recoverable content or title
- **When:** they migrate
- **Then:** each receives its own opaque ID unless legacy evidence explicitly proves one identity

### Requirement: LIFE-02

Every successful create, update, rename-with-content, and restore produces one immutable,
monotonically numbered revision record and retained portable-page bytes; history is not
conditional on a flag.

#### Scenario: Normal behavior

- **Given:** an artifact at revision 2
- **When:** an update succeeds
- **Then:** revision 3 is retained and revisions 1 and 2 remain byte-for-byte unchanged

#### Scenario: Failure or refusal

- **Given:** a write fails before commit
- **When:** recovery inspects history
- **Then:** no successful revision number is skipped or partially materialized

#### Scenario: Relevant boundary

- **Given:** a legacy unversioned page has only one recoverable byte sequence
- **When:** it migrates
- **Then:** exactly one revision is recorded and no earlier content is invented

### Requirement: LIFE-07

Schema-versioned metadata records ID, slug, title, icon, description, timestamps, head,
immutable revision metadata, byte size, content hash, provenance, author when known, and
deployment references, with exact validation and repair diagnostics.

#### Scenario: Normal behavior

- **Given:** a valid schema-2 manifest
- **When:** it is read
- **Then:** all artifact and revision fields validate and the selected head matches retained bytes

#### Scenario: Failure or refusal

- **Given:** duplicate IDs/slugs, an invalid head, unsafe reference, or mismatched hash
- **When:** the manifest is read or migrated
- **Then:** a typed error or repair report is returned instead of an empty manifest

#### Scenario: Relevant boundary

- **Given:** author or deployment information was never known
- **When:** metadata is produced
- **Then:** absence is represented explicitly without fabricated values

### Requirement: OPS-03

Local lifecycle migration creates a verified exact backup, exposes integrity results, and
supports a tested restore of the prior selected store before a new schema is default-enabled.

#### Scenario: Normal behavior

- **Given:** a valid legacy store
- **When:** migration completes and its backup is restored in a drill
- **Then:** the restored old bytes and selection match the pre-migration inventory

#### Scenario: Failure or refusal

- **Given:** backup creation or verification fails
- **When:** migration is requested
- **Then:** selection remains on the old store and the failure names the next safe action

#### Scenario: Relevant boundary

- **Given:** a backup contains private artifact content
- **When:** evidence is retained
- **Then:** only hashes and synthetic fixture results are recorded, not the content

### Requirement: OPS-05

Schema migration has explicit preflight, staged preparation, verification, selection,
post-change verification, and rollback; failed rollout preserves or restores the last known
good compatible state.

#### Scenario: Normal behavior

- **Given:** preflight and staged verification pass
- **When:** schema 2 is selected
- **Then:** post-change verification proves all artifact heads and revisions readable

#### Scenario: Failure or refusal

- **Given:** interruption or validation failure at any migration boundary
- **When:** recovery runs
- **Then:** it selects a complete old or complete new store and reports which one

#### Scenario: Relevant boundary

- **Given:** the filesystem platform lacks required migration evidence
- **When:** default enablement is evaluated
- **Then:** schema 2 remains disabled on that platform

### Requirement: OPS-07

Inspection, migration, repair, and rollback are idempotent or resumable and emit bounded
machine-readable progress/results without requiring undocumented direct store edits.

#### Scenario: Normal behavior

- **Given:** an interrupted prepared migration
- **When:** the command is rerun
- **Then:** it resumes or safely restarts from recorded state and reaches the same result

#### Scenario: Failure or refusal

- **Given:** the recorded operation token conflicts with current store identity
- **When:** resume is attempted
- **Then:** it refuses mutation and provides a bounded repair report

#### Scenario: Relevant boundary

- **Given:** a completed migration is invoked again
- **When:** inputs are unchanged
- **Then:** it reports the prior completion without creating another backup or identity

### Requirement: COMPAT-03

Manifest, revision, state-export, and provider-migration records carry integer schema
versions. Migrations are forward-only, backed up, idempotent, and fault-tested from every
released prior shape; unknown future versions fail without mutation.

#### Scenario: Normal behavior

- **Given:** any released legacy fixture
- **When:** it migrates to schema 2
- **Then:** all recoverable content and metadata validate in the new schema

#### Scenario: Failure or refusal

- **Given:** a manifest with a schema version newer than the runtime understands
- **When:** any read-write operation opens it
- **Then:** the operation fails before writing or selecting a replacement

#### Scenario: Relevant boundary

- **Given:** historical Cloudflare state uses a shared-KV key shape
- **When:** the offline provider migration fixture runs
- **Then:** records are mapped to explicit site/artifact scope or reported ambiguous without provider mutation

### Requirement: COMPAT-04

Upgrade and rollback preserve artifact IDs, slug references, revision selection, state
association, and deployment references; ambiguous legacy mappings are reported instead of
cross-wired.

#### Scenario: Normal behavior

- **Given:** a legacy artifact with local state and deployment metadata
- **When:** upgrade and rollback round-trip
- **Then:** every association returns to the same artifact and selected revision

#### Scenario: Failure or refusal

- **Given:** two legacy records cannot be safely associated with one state namespace
- **When:** migration preflight runs
- **Then:** it refuses that association and names the ambiguous records

#### Scenario: Relevant boundary

- **Given:** an artifact slug changed after migration
- **When:** a later package upgrade runs
- **Then:** it follows opaque identity rather than attaching data by the old title or slug

### Requirement: QUAL-02

Identity, schema validation, migration, backup, repair, and rollback behavior has deterministic
unit, property, fixture, and fault tests independent of network, wall-clock ordering, and
developer-specific paths.

#### Scenario: Normal behavior

- **Given:** the synthetic lifecycle fixture corpus
- **When:** the deterministic suite runs
- **Then:** all normal migration and identity properties pass with fixed observable inputs

#### Scenario: Failure or refusal

- **Given:** a migration path has no failure or rollback test
- **When:** implementation verification runs
- **Then:** the packet and Phase 1 gate fail

#### Scenario: Relevant boundary

- **Given:** a real supported filesystem result is unavailable
- **When:** unit tests pass elsewhere
- **Then:** the platform remains unverified and is not inferred from synthetic evidence
