# Proposal: Separate OpenCode artifact permissions

## Outcome

OpenCode users can independently allow, ask, or deny local artifact writes, datasource
authority, public deployment, and audience expansion. A refusal fails closed before any
filesystem or provider mutation and reports what remained unchanged.

## Context

`artifact_publish` currently asks once under `artifact_publish`, then may also register shell
datasources and deploy to a public target. That one approval can therefore authorize materially
different capabilities and audience. Stable OpenCode supports named `ctx.ask` permission
resources plus `allow`, `ask`, `deny`, and auto mode, so these authorities can be separated
without adopting the V2 beta API.

## Scope

- In scope: four permission resources, exact bounded patterns/metadata, prompt ordering,
  denial/no-write/no-provider guarantees, auto-mode behavior, and real stable-host tests.
- Out of scope: executing viewer-supplied commands, remembering broader grants, changing
  provider credentials, deploying a real site, or changing hosted identity/authorization.

## Risks and rollback

- Risk: asking too late can leave a local write after a deploy refusal; asking too broadly can
  turn one remembered choice into persistent datasource or public-audience authority.
- Rollback: retain only local publication behind its existing exact permission and disable
  datasource/deploy/audience options until the stable host proves each separated resource.

## Validation plan

Unit tests record exact ask order and metadata, then inject allow/deny at every transition and
assert no unauthorized runner or write. Packed OpenCode tests cover allow, ask, explicit deny,
and auto mode using the official [permission contract](https://opencode.ai/docs/permissions/).
