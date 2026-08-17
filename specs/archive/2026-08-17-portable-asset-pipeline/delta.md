# Specification delta: Add a contained offline asset pipeline

## MODIFIED

### Requirement: RENDER-04

The renderer inlines only required runtimes and embeds each declared local asset from an
explicit worktree root after containment, regular-file, content-type, active-content, and size
validation. Missing, external, unsupported, changed-during-read, or unlabelled meaningful
assets fail preflight; strict offline pages never emit a broken remote reference.

#### Scenario: Normal behavior

- **Given:** a contained allowlisted image with meaningful alt text
- **When:** Markdown rendering completes
- **Then:** the page contains a hashed data URI and makes no view-time request

#### Scenario: Failure or refusal

- **Given:** a missing, external, mislabeled, active, or oversized asset
- **When:** preflight resolves it
- **Then:** publication performs no writes and returns a bounded actionable diagnostic

#### Scenario: Relevant boundary

- **Given:** a path or symlink resolves outside the explicit worktree root
- **When:** containment is checked before and after reading
- **Then:** the asset bytes are not returned or embedded

### Requirement: RENDER-05

The 15 MiB default final-page cap applies after data-URI encoding, generated markup, runtimes,
and footer expansion. Source, per-asset, asset-count, aggregate-read, encoded, and final-output
limits are checked before publication without allocating unbounded content.

#### Scenario: Normal behavior

- **Given:** all expanded contributions remain within every limit
- **When:** final HTML is assembled
- **Then:** reported byte accounting equals the bytes passed to the lifecycle transaction

#### Scenario: Failure or refusal

- **Given:** base64 or footer expansion would exceed the final cap
- **When:** final accounting runs
- **Then:** publication refuses before selecting a new revision

#### Scenario: Relevant boundary

- **Given:** input is exactly at a documented hard limit
- **When:** it is encoded deterministically
- **Then:** the boundary is accepted while the next byte is rejected

### Requirement: SEC-02

Asset paths, MIME claims, metadata, SVG content, counts, and sizes are untrusted and bounded.
Resolution uses safe relative syntax plus realpath containment and refuses special files,
encoded separators, symlink changes, and ambiguous types before authority or output expansion.

#### Scenario: Normal behavior

- **Given:** a stable regular file beneath the authorized root
- **When:** its declared and detected properties agree
- **Then:** only its exact bounded bytes and safe metadata enter the renderer

#### Scenario: Failure or refusal

- **Given:** traversal, a device/FIFO, or content whose bytes contradict its declaration
- **When:** validation runs
- **Then:** access fails closed without reading beyond the configured bound

#### Scenario: Relevant boundary

- **Given:** the file identity changes between inspection and read
- **When:** post-read verification runs
- **Then:** the candidate is discarded and no publication mutation occurs
