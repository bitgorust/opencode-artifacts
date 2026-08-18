# Proposal: Expose bounded lifecycle results and reopen

## Outcome

Artifact tool calls return a short model-readable summary plus bounded structured metadata,
and users can reopen an exact artifact through a stable tool operation and an injected
`/artifact-reopen` command. The CLI `latest --open` remains the service-independent fallback.

## Context

The stable OpenCode 1.18.18 tool contract supports `{title, output, metadata, attachments}` and
the config hook supports custom prompt commands. Current tools mostly return ad hoc strings or
JSON text, which makes successful identity/revision/visibility results harder for models and
users to consume. Reopening is available only through the standalone CLI.

## Scope

- In scope: a versioned bounded result envelope in stable tool metadata, concise text summaries,
  consistent typed failures, `artifact_lifecycle` reopen-by-exact-reference, a stable config-
  injected `/artifact-reopen` prompt command, deprecation documentation, and host tests.
- Out of scope: V2 plugin entrypoints, TUI-private hooks, overriding built-in keybindings,
  removing any existing argument/result spelling, arbitrary file opening, or returning full
  large HTML in metadata.

## Risks and rollback

- Risk: changing returned text can break agents that parse prose, and opening a fuzzy or stale
  path can show the wrong artifact.
- Rollback: preserve existing text fields/argument spellings for the deprecation window, omit
  the injected command if the stable config hook rejects it, and retain `latest --open`.

## Validation plan

Contract tests cap every output/metadata field, retain old input spellings, and prove exact
reference resolution. A clean packed host discovers the new operation, executes structured
list/status/read/publish paths, and sees `/artifact-reopen`; a launcher fake verifies the exact
selected path while invalid/ambiguous references open nothing. This packet changes public
plugin tool arguments/results and therefore requires explicit approval before implementation.
