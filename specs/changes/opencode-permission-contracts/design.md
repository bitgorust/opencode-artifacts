# Design: Separate OpenCode artifact permissions

Required for high-risk changes.

## Context and constraints

Preflight and final-byte secret scanning must finish before authority is requested. Local
publication, datasource registration/execution authority, provider deployment, and increasing
the audience to public-static are distinct side effects. Existing `artifact_publish` callers
must remain source-compatible, but their old single approval cannot authorize new scopes.

## Chosen design

Model one invocation as a monotonic state machine:

`validated -> local-approved -> datasource-approved? -> deploy-approved? -> audience-approved? -> commit`

Use `artifact_publish`, `artifact_datasource`, `artifact_deploy`, and `artifact_audience` as
separate resources. Ask only for requested capabilities, use exact slug/source/target/
visibility patterns, set `always: []` for elevated scopes, and include bounded non-secret
metadata. Resolve every required approval before the first write or runner/provider call. A
denial throws a bounded typed result naming the denied layer and confirming no mutation.

## Alternatives

A single composite prompt is simpler but cannot be independently configured or safely
remembered. Separate tools would make authority obvious but would break the documented one-call
publish workflow and add partial orchestration states. Asking after local publication preserves
today's order but violates the no-partial-mutation refusal contract.

## Trust, privacy, and failure boundaries

Permission patterns never contain Markdown, credentials, shell output, or provider secrets.
Datasource metadata carries registered names and executable basenames, not arguments. Provider
and audience asks identify capability, target, and visibility. All denials, aborts, malformed
rules, and missing host support fail before writes/network calls; exact explicit `deny` remains
effective under auto mode.

## Migration, rollout, and rollback

Add resources without reinterpreting saved `artifact_publish` grants. Existing callers keep
their arguments, but datasource/deploy requests now require additional approval. Roll out only
after stable-host allow/ask/deny/auto tests pass. Rollback disables elevated options rather than
folding them back under the local-write grant.

## Formal-method decision

- Decision: bounded state-machine/property model.
- Property and rationale: for every requested-scope subset and allow/deny transition, no write
  or external call occurs unless all required permissions precede it; auto mode never overrides
  an explicit deny.
- Model/evidence path: planned `test/model/opencode-permission-model.ts` plus integration tests
  with injected asks, writers, and provider runners.
