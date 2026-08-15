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
