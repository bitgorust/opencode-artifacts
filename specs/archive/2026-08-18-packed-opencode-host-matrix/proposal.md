# Proposal: Verify packed OpenCode host compatibility

## Outcome

Users can install the exact packed package through the stable OpenCode flow and see every
documented tool on a clean host. CI proves the initial compatibility floor against the exact
current stable host rather than inferring it from workspace unit tests or a peer range.

## Context

The repository has a dated OpenCode 1.18.18 checkout/package observation, but CI does not load
the tarball into a clean OpenCode cache or execute the live discovery surface. On 2026-08-18,
the registry also reports `opencode-ai@1.18.18` and `@opencode-ai/plugin@1.18.18` as current.
The support policy deliberately treats that one exact release as both the initial current and
oldest-tested candidate until a second release receives identical coverage.

## Scope

- In scope: exact tarball pack/install, `opencode plugin` and config-array paths, clean config/
  data/cache/state roots, stable headless health and tool discovery, safe read-only smoke,
  current/oldest version resolution, peer/engine claim narrowing, and retained CI artifacts.
- Out of scope: publishing to npm, adding a V2 beta adapter, claiming OS/browser support,
  exercising provider models, paid inference, or treating a moving `latest` label as evidence.

## Risks and rollback

- Risk: network or host-release churn can make CI flaky, while an overly broad peer range can
  imply compatibility not actually tested.
- Rollback: keep the stable adapter, pin the observed host cell, narrow the compatibility
  claim, and surface a failed/unverified matrix cell; never replace a failed host probe with a
  workspace-only pass.

## Validation plan

A hermetic harness builds one tarball, installs that file into empty roots, starts the exact
stable host, verifies health and documented tool IDs/schemas, and performs non-mutating
list/status probes. CI retains package digest, host version, config, discovery output, logs,
and explicit failures. The official stable [CLI](https://opencode.ai/docs/cli/) and
[plugin configuration](https://opencode.ai/docs/plugins/) contracts are the source boundary.
