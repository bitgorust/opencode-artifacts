# OpenCode host verification

Date: 2026-08-15

Host: Linux x64

OpenCode: 1.18.18, installed from the official `opencode-ai` npm package

## Installation

OpenCode was not initially present. It was installed into the persistent user-local prefix:

```bash
npm install -g --prefix /home/ubuntu/.local opencode-ai
```

Verification:

```text
$ which opencode
/home/ubuntu/.local/bin/opencode
$ opencode --version
1.18.18
```

The install method is documented by the official
[OpenCode introduction](https://opencode.ai/docs). The installed CLI also exposes
`opencode plugin <module>`, matching the official [CLI documentation](https://opencode.ai/docs/cli/).

## Plugin load probe

The repository was built first with `npm run build`. OpenCode was then started with an empty
temporary XDG config/data/cache/state set and this checkout as the only inline plugin:

```bash
OPENCODE_CONFIG_CONTENT='{"plugin":["file:///home/ubuntu/opencode-artifacts"]}' \
  opencode serve --port 49876 --hostname 127.0.0.1
```

The official [server API](https://opencode.ai/docs/server/) health and experimental tool-ID
endpoints returned:

```text
GET /global/health
{"healthy":true,"version":"1.18.18"}

GET /experimental/tool/ids
[...,"artifact_publish","artifact_db","artifact_state","artifact_comments"]
```

The server was terminated after the probe. This proves that the local checkout loads through
the real stable host and registers all shipped tools. It does not replace the roadmap gate to
repeat the test from a packed npm tarball in clean CI across the supported OpenCode range.

## Previously published package probe

The npm registry's latest package at the time of this audit was 0.14.3, published before the
security-hardening commit. That exact registry package was installed into an isolated
temporary dependency tree, then loaded as the only plugin by a second clean OpenCode 1.18.18
process. Its tool endpoint returned:

```text
artifact_comments
artifact_db
artifact_publish
artifact_state
```

This confirms that the previously published plugin still registers in the current host; the
hardening was not needed merely to make it load. Existing static/local artifact HTML and
manifest data remain compatible with the hardened code. Cloudflare deployments are the one
migration exception: old Workers continue using the historical shared `ARTIFACTS_KV`
namespace, while the next release creates a worker-scoped namespace and does not
automatically copy mutable decisions, comments, or mini-DB documents. See
[`docs/hosted-cloudflare.md`](../hosted-cloudflare.md).

## Exact packed stable-host matrix — 2026-08-18

Host: Ubuntu 24.04.4 LTS, Linux 6.8.0-137-generic x86_64. Node: 24.19.0.
OpenCode stable current/oldest-tested: exact 1.18.18. V2 beta was excluded. No model provider
or inference endpoint was called.

The candidate was built and packed once, then installed from
`opencode-artifacts-0.15.0.tgz` into an empty dependency prefix with lifecycle scripts
disabled. The initial verified candidate SHA-256 was
`901a1ee6439dd97a0142d63aacecdebd67d2660f4a8ad37a96c559e42a4dd5cf`; Goal 4's final
gate reruns this command and replaces the digest if later packet work changes shipped bytes.

The first attempted shortcut—placing the `.tgz` URL directly in the `plugin` array or passing
the tarball path directly to `opencode plugin`—was rejected as evidence. Stable OpenCode treats
the first as a module URL and resolves the second as the tarball's parent package directory;
it does not unpack that input. The successful candidate procedure therefore uses `npm install`
to unpack the exact tarball into an empty prefix, then passes the resulting package-directory
`file:` URL to the official plugin command. This is distinct from the checkout-based local
development route.

`scripts/opencode-host-matrix.ts` executed two clean routes with separate project and XDG
config/data/cache/state roots:

1. the official `opencode plugin file:///…/node_modules/opencode-artifacts` command, followed
   by restart from the configuration it wrote; and
2. direct `plugin` array configuration of that same extracted exact package.

Both loopback servers returned `{"healthy":true,"version":"1.18.18"}` and exposed these
candidate tools through live discovery and full JSON-schema comparison:

```text
artifact_publish
artifact_lifecycle
artifact_db
artifact_state
artifact_comments
```

A direct execution of the packed plugin's `artifact_lifecycle list` returned schema version 1
with an empty artifact list and left the prepared manifest byte-for-byte unchanged. This
exercises safe shipped tool code without asking a provider model to select a tool. The matrix
recorded one deduplicated version cell because current stable and oldest-tested are identical;
it explicitly sets `broaderRangeProven: false`.

The local JSON result is `/tmp/goal4-newpack/opencode-host-matrix.json`; CI generates the same
record as `release-evidence/opencode-host-matrix.json` and retains it with the exact tarball.
The `/tmp` path is transient and is not itself release evidence. Bare registry-coordinate
verification of future candidate bytes remains a post-publication gate; the dated published-
package probe above covers the already published route only.
