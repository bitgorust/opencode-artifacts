# Ubuntu exact packed-candidate observation — 2026-08-16

Status: tested technical observation, not a supported platform/browser cell and not an
`OUT-02` participant result.

## Exact candidate and environment

[GitHub Actions run 31957619885](https://github.com/bitgorust/opencode-artifacts/actions/runs/31957619885)
passed for branch head `88052dc5d7b192ccddd52d91d35fe307553647bb`. Its pull-request merge
candidate was `502d861800d67a2be178f792a70a7fdaeb84173d`. Retained artifact
`exact-candidate-evidence` (ID `9266367868`, expiry 2026-08-30) supplied the exact package:

```text
filename: opencode-artifacts-0.14.3.tgz
size: 50,206 bytes
SHA-256: f2becdaaa12e340bd445d8e5fb2e3155a231fab3e284d57494361e05cf8a25a8
```

The observation environment was:

```text
OS: Ubuntu 24.04.4 LTS (Noble), Linux 6.8.0-106-generic, x86_64
Node: 24.19.0 from the complete official Linux x64 distribution
npm installer: 11.17.0
OpenCode: 1.18.18
browser: Google Chrome for Testing 145.0.7632.6 (Playwright Chromium 1.62.1)
```

## Clean packed install and real host

The tarball was installed into a new temporary prefix with no repository source path. npm
installed 207 packages. The packed plugin contained `dist/plugin.js`; `src/` was absent.

OpenCode ran with empty temporary XDG config, data, cache, and state directories and the
installed package directory as its only inline plugin. The real server returned:

```json
{"healthy":true,"version":"1.18.18"}
```

Its real `/experimental/tool/ids` response contained all four shipped tools:

```text
artifact_publish
artifact_db
artifact_state
artifact_comments
```

The loopback server was then stopped. Initial launches inside the filesystem sandbox failed
with a generic `ServeError` before binding; the approved unsandboxed process produced the
successful health/tool result. No model call, provider credential, publish, or external
deployment was performed.

## CLI render, offline reopen, and removal

The installed package CLI rendered a new synthetic two-renderer fixture without using the
checkout:

```text
output size: 1,732,517 bytes
output SHA-256: 9fd5cf318a9c6c718103ea873f8a8215320807e77450437586780c1a8c436c94
```

The output carried the strict on-disk `connect-src 'none'` CSP and bundled both Vega and
ECharts runtimes. The entire installed package/dependency tree was moved away before opening
the generated `file://` page in Chromium. Browser results:

- two of two charts rendered;
- the only request was the initial local HTML file;
- zero console errors, page errors, or dialogs;
- document and viewport widths both remained 1280 CSS pixels;
- keyboard Enter changed the theme from system/default to dark;
- keyboard ArrowRight changed the Vega range control from 2 to 3; and
- `VEGA_DEBUG` and the application Vega View global were both undefined.

This verifies the exact candidate's technical install, host registration, render, offline
interaction, and post-removal portability on the observed combination.

## Why the target cell remains unverified

The Ubuntu target requires the latest two stable Chromium and Firefox generations plus the
complete clean first-use scope. This run exercised one Chrome-for-Testing build, no Firefox,
and no consented first-time user following only the README. It therefore cannot become a
supported cell, cannot satisfy `OUT-02`, and cannot be combined with separate observations to
claim broader browser or host support.
