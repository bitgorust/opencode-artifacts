# Native OpenCode integration

## Current behavior

- `OC-01`: the exact npm tarball loads through stable OpenCode and registers
  `artifact_publish`, `artifact_lifecycle`, `artifact_db`, `artifact_state`, and
  `artifact_comments` with their shipped argument schemas.
- `OC-02`: the primary published-package command is `opencode plugin opencode-artifacts`.
  Candidate-byte verification first installs the tarball into an empty package prefix and
  passes that extracted package URL to the same official plugin command. Direct `plugin`
  configuration is tested separately. A checkout `file:` URL remains development-only.
- `OC-03`: CI packs once, installs those bytes with candidate lifecycle scripts disabled,
  installs the exact pinned stable host, and retains health, config, discovery, schemas,
  smoke output, bounded logs, versions, and package digest.
- `OC-04`: current stable and oldest-tested are initially the same exact OpenCode 1.18.18
  cell. The peer SDK claim is exact `@opencode-ai/plugin@1.18.18`; no wider 1.x or V2 beta
  compatibility is implied.
- `QUAL-03`: each host route uses empty config/data/cache/state roots and a loopback server.
  Tool discovery requests schema metadata only and performs no provider inference. A packed-
  module `artifact_lifecycle list` smoke is non-mutating and separately proves executable
  shipped code without asking a model to select the tool.
- `UX-03`: `artifact_publish` completes final-byte validation, then asks for every requested
  authority before its first write or provider call. The order is exact local publication,
  optional datasource execution, optional provider deployment, then optional public audience.
  A refusal at any point returns `permission-denied` with `mutation: none`.
- `OC-06`: stable permission resources are `artifact_publish`, `artifact_datasource`,
  `artifact_deploy`, and `artifact_audience`. Local remembered scope is bound to one hashed
  artifact key; elevated scopes use `always: []`. Metadata is bounded and omits authored
  Markdown, datasource arguments, full executable paths, credentials, and provider output.
  Stable OpenCode 1.18.18 preserves exact `allow`/`ask`/`deny` rules, including explicit deploy
  and audience deny entries beneath a broad auto-allow wildcard.
- `LIFE-06`, `COMPAT-05`: the stable lifecycle schema adds `op: "reopen"`. The plugin config
  hook injects `/artifact-reopen` only when that command name is free, and leaves a user-owned
  command untouched. Stable results use `{title, output, metadata}` with a bounded version-1
  `metadata.artifactResult`; the non-enumerable string conversion returns the same `output` for
  direct legacy callers.

## Evidence boundary

- `scripts/opencode-host-matrix.ts` is the executable packed-host contract and
  `.github/workflows/ci.yml` retains its JSON output with exact candidate evidence.
- `docs/evidence/opencode-host-verification.md` records the dated manual run, including the
  rejected direct-tarball assumption and the exact successful install boundary.
- A registry-coordinate check for an unpublished candidate is impossible before publication.
  The bare published-package route remains post-publication evidence; it is not substituted
  for the exact pre-publication tarball.
- `test/model/opencode-permission-model.ts` exhausts optional-scope subsets and denial
  transitions. Stable-host evidence confirms policy parsing and exact precedence without
  provider inference; tool-selection enforcement is covered by injected `ctx.ask` integration
  because native tool execution otherwise requires a provider turn.
- Packed discovery requires the `reopen` enum member and the effective injected command.
  `opencode-artifacts latest --open` is tested separately with an injectable launcher and does
  not depend on the host config hook.
