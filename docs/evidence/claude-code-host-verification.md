# Claude Code host verification

Date: 2026-08-15

Host: Linux x64

Claude Code: 2.1.233, native install on the `latest` channel

## Official-source coverage

The official [Claude Code documentation index](https://code.claude.com/docs/llms.txt) was
searched for Artifact-specific pages and reference entries. It currently lists one dedicated
Artifact guide plus related reference and release pages:

| Source | What was checked |
|---|---|
| [Artifacts guide](https://code.claude.com/docs/en/artifacts) | lifecycle, sharing, connectors, constraints, availability, user/admin controls, retention, audit, and Compliance API links |
| [Tools reference](https://code.claude.com/docs/en/tools-reference) | `Artifact` is a permissioned built-in tool, not a CLI subcommand |
| [Settings](https://code.claude.com/docs/en/settings) | `disableArtifact`, user-level `enableArtifact`, precedence, and version floor |
| [Environment variables](https://code.claude.com/docs/en/env-vars) | `CLAUDE_CODE_DISABLE_ARTIFACT` and `CLAUDE_CODE_ARTIFACT_AUTO_OPEN` |
| [Permissions](https://code.claude.com/docs/en/permissions) | generic deny-rule semantics used by the Artifact guide's `Artifact` rule |
| [Feature availability](https://code.claude.com/docs/en/feature-availability) | plan/provider availability and Enterprise admin enablement |
| [Week 25 release digest](https://code.claude.com/docs/en/whats-new/2026-w25) | initial CLI release in 2.1.183 |
| [Week 29 release digest](https://code.claude.com/docs/en/whats-new/2026-w29) | viewer-scoped MCP connectors, public links, editor roles, and Claude Tag support |
| [Compliance API reference](https://platform.claude.com/docs/en/api/compliance/code/artifacts) | list, retrieve-version-content, and delete operations |
| [Interactive mode](https://code.claude.com/docs/en/interactive-mode) | general shortcut table; it does not currently repeat the Artifact guide's `Ctrl+]` shortcut |
| [Changelog](https://code.claude.com/docs/en/changelog) | current 2.1.233 release and historical entries; no separate Artifact feature entry was found |

The [June 2026 launch post](https://claude.com/blog/artifacts-in-claude-code) was also checked
as historical context. It says the beta was Team/Enterprise-only and could not be public.
The current Artifact guide supersedes those launch-time limits: it includes Pro and Max plans
and public links, subject to plan and organization policy.

## Installation and health check

Claude Code was not present before this audit. It was installed with Anthropic's recommended
native Linux method from the official [setup guide](https://code.claude.com/docs/en/setup):

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

The installed command reports:

```text
$ claude --version
2.1.233 (Claude Code)

$ claude doctor
Running: native (2.1.233)
Commit: f8d57569aaf3
Platform: linux-x64
Config install method: native
Search: OK (bundled)
Auto-updates: enabled
Auto-update channel: latest
No installation issues found.
```

The executable resolves to
`/home/ubuntu/.local/share/claude/versions/2.1.233`. The normal help output contains no
Artifact subcommand, consistent with the official tools reference: publishing is an
agent-visible `Artifact` tool inside an authenticated session.

## Authentication boundary

No Claude credentials were present or requested:

```json
{
  "loggedIn": false,
  "authMethod": "none",
  "apiProvider": "firstParty"
}
```

The official availability contract requires a Pro, Max, Team, or Enterprise claude.ai
session authenticated through `/login`. It explicitly excludes API-key, gateway-token, and
cloud-provider sessions. Therefore this audit did **not** publish to claude.ai, inspect an
account gallery, alter sharing policy, call a viewer connector, or exercise organization
administration. Those are service/account tests, not installation tests.

## Local surface inspection

A focused string survey of the installed 2.1.233 binary corroborated that this build ships:

- the `disableArtifact` and `enableArtifact` settings and both documented environment
  variables;
- bundled Artifact design, diagramming, capability, and PR-review skills;
- publish/read/list/watch, comment, page-data/decision, and small database action families;
- stale-update, permission, ownership, runtime-contract, and sharing guards.

This is presence evidence only. Undocumented names can be gated, experimental, changed, or
unreachable for this account, so they remain supplemental research and are not used as the
normative parity contract.

## Conclusion

The current Claude Code CLI is installed and healthy, the official Artifact documentation
surface has been audited, and local shipped registration/configuration has been inspected.
An authenticated Claude subscription is the remaining prerequisite for a real hosted
publish/share/connector smoke test.
