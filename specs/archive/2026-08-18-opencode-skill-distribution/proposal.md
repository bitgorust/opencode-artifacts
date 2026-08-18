# Proposal: Install the artifact skill through official discovery

## Outcome

After installing the packed plugin, users can explicitly install the bundled `artifact-pages`
skill into an official project or global OpenCode skill directory. A clean host advertises and
loads it on demand without proactive prompt injection or a repository checkout.

## Context

The tarball contains `skills/artifact-pages`, but stable OpenCode discovers project skills from
`.opencode/skills` and global skills from `~/.config/opencode/skills`; an arbitrary directory
inside an npm package is not advertised automatically. The current README offers a generic
`.agents/skills` copy command, with no idempotence, collision, or packed-host test.

## Scope

- In scope: `opencode-artifacts skill install --project|--global`, exact official destinations,
  contained bundled files, atomic/idempotent copy, collision refusal and explicit force,
  uninstall instructions, clean packed-host advertisement/load checks, and frontmatter tests.
- Out of scope: postinstall scripts, silent home-directory writes, default proactive injection,
  changing skill permissions, V2 skill registration, or deleting user-modified skill files.

## Risks and rollback

- Risk: an installer can overwrite a customized skill or place files where the host never
  discovers them.
- Rollback: make installation explicit, compare the complete destination before no-op, refuse
  differing content unless `--force` names the exact directory, and document manual removal.

## Validation plan

Filesystem tests cover project/global destinations, traversal/symlink/collision/atomicity, and
packed-byte source resolution. The packed-host matrix installs the skill into an empty official
directory, confirms it appears in the stable native `skill` tool description, loads it, and
records exact host/package versions. The discovery contract follows the official
[Agent Skills documentation](https://opencode.ai/docs/skills/).
