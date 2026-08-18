# Specification delta: Verify packed OpenCode host compatibility

## MODIFIED

### Requirement: OC-01

The exact packed npm package loads through the stable OpenCode plugin API and exposes every
documented artifact tool with the shipped argument schema.

#### Scenario: Normal behavior
- **Given:** the candidate tarball installed into a clean stable OpenCode host
- **When:** the live tool discovery endpoint is queried
- **Then:** all documented artifact tool IDs and schemas are present

#### Scenario: Failure or refusal
- **Given:** the package or a runtime dependency cannot load
- **When:** host discovery runs
- **Then:** the cell fails with bounded host/package logs and cannot become compatibility evidence

#### Scenario: Relevant boundary
- **Given:** the worktree and developer `node_modules` are unavailable
- **When:** the packed plugin loads
- **Then:** every runtime import resolves only from installed tarball dependencies

### Requirement: OC-02

The stable host supports the official `opencode plugin opencode-artifacts` install, direct
`plugin` array configuration, and an explicit local development path, with each route documented
according to its actual cache and dependency behavior.

#### Scenario: Normal behavior
- **Given:** empty project and OpenCode configuration roots
- **When:** the official plugin command installs the package
- **Then:** configuration is updated and the installed plugin is discoverable after restart

#### Scenario: Failure or refusal
- **Given:** install, cache, or config mutation fails
- **When:** OpenCode starts
- **Then:** the user sees the failing layer and a clean retry path without a claimed pass

#### Scenario: Relevant boundary
- **Given:** a contributor selects a local `file:` package
- **When:** the development workflow runs
- **Then:** it uses the built checkout explicitly and is not reported as packed or registry evidence

### Requirement: OC-03

CI builds one npm tarball and tests those exact bytes against the current stable OpenCode host;
workspace-only tests remain necessary but insufficient.

#### Scenario: Normal behavior
- **Given:** a pull request candidate
- **When:** the packed-host CI job runs
- **Then:** it installs the generated tarball into clean roots and retains discovery/smoke output

#### Scenario: Failure or refusal
- **Given:** any pack, install, startup, discovery, or smoke step fails
- **When:** CI reconciles the job
- **Then:** the required check fails and preserves the responsible layer's bounded log

#### Scenario: Relevant boundary
- **Given:** the registry has a newer OpenCode release than the pinned observation
- **When:** CI resolves the current cell
- **Then:** it records the exact resolved version and does not reuse older evidence for it

### Requirement: OC-04

The compatibility policy names exact current and oldest-tested stable OpenCode releases and
promotes only releases that passed identical packed-host coverage. Initially those cells may be
the same exact version.

#### Scenario: Normal behavior
- **Given:** OpenCode 1.18.18 passes the complete packed-host cell
- **When:** compatibility status is published
- **Then:** it is recorded as the initial exact current and oldest-tested observation

#### Scenario: Failure or refusal
- **Given:** a claimed host version lacks or fails equivalent evidence
- **When:** policy validation runs
- **Then:** that version remains unverified or unsupported rather than entering the peer claim

#### Scenario: Relevant boundary
- **Given:** a V2 beta or development tag is available
- **When:** stable compatibility is calculated
- **Then:** the tag is excluded and no beta entrypoint silently replaces stable behavior

### Requirement: QUAL-03

Packed-plugin acceptance uses a clean config/data/cache/state environment, an exact package
digest and host version, live health/tool discovery, schema comparison, and safe non-mutating
tool smoke for the initial current/oldest stable matrix.

#### Scenario: Normal behavior
- **Given:** the exact candidate tarball and stable host versions
- **When:** the matrix executes
- **Then:** every cell retains config, versions, digest, health, schemas, smoke results, and logs

#### Scenario: Failure or refusal
- **Given:** a cell is skipped, excluded, flaky, or fails
- **When:** evidence is written
- **Then:** its disposition is visible and the matrix does not report complete

#### Scenario: Relevant boundary
- **Given:** current and oldest-supported intentionally resolve to one initial version
- **When:** the gate runs
- **Then:** it executes one deduplicated exact cell and states that no broader host range is proven
