# Portable renderer correctness

## Current behavior

- `RENDER-02`: CLI and plugin Markdown publication runs one side-effect-free preflight before
  permission or writes. Frontmatter, component/table, chart, Mermaid, heading-anchor,
  task-marker, alert, and asset diagnostics carry stable codes, severity, line/column, and a
  next action in source order. Errors refuse publication; warnings remain visible on success.
- `RENDER-02`: reports retain at most 50 diagnostics and 16 KiB of diagnostic JSON by default.
  Sensitive-looking values are redacted, messages/actions are truncated, and any overflow
  ends in a `diagnostics-omitted` error with the exact omitted count. Raw HTML remains an
  explicit trusted mode and produces a visible `trusted-html-mode` warning plus permission
  metadata.
- `QUAL-02`: component and chart acceptance is shared by preflight and rendering. Standalone
  rendering preserves escaped inline error boxes, while every checked-in pattern must pass
  preflight without errors and CLI/plugin refusals are verified as no-write behavior.
- `RENDER-04`: Markdown images published through the CLI or plugin resolve only from the
  explicit project worktree. PNG, JPEG, GIF, WebP, and a conservatively reconstructed SVG
  subset become hashed data URIs. External, absolute, traversal, encoded-separator, missing,
  symlinked, non-regular, mislabeled, active, changed-during-read, or unlabelled image inputs
  fail before the permission prompt or any publication write. An exact image title of
  `decorative` explicitly selects empty-alt presentation semantics.
- `RENDER-04`: optional frontmatter `font:` declarations accept contained WOFF, WOFF2, TTF,
  or OTF bytes under the same resolver and generate a fixed `@font-face`. The on-disk CSP adds
  only `font-src data:`, so embedded fonts load without granting network authority.
- `RENDER-05`: Markdown source, declaration count, each source asset, aggregate decoded asset
  bytes, encoded contributions, rendered HTML, and footer-expanded publication bytes are
  bounded. The final default limit remains 15 MiB and is enforced before lifecycle commit.
- `SEC-02`: resolution is independent of process cwd after the caller supplies its worktree
  root. It checks every path segment, opens regular files without following the final symlink,
  compares descriptor identity across a bounded read, repeats realpath containment, detects
  MIME from bytes, and never fetches.

## Limits

| Boundary | Default |
|---|---:|
| Markdown source | 1 MiB |
| Declared assets | 64 |
| One decoded asset | 4 MiB |
| All decoded assets | 10 MiB |
| Final footer-expanded page | 15 MiB |

Exact limits are accepted; the next byte or declaration is refused. SVG accepts only a
generated allowlist of static geometry/text elements and attributes. It rejects entities,
processing instructions, external references, style, event handlers, active elements, and
malformed or unknown markup.

## Evidence boundary

- `test/assets.test.ts` and `test/model/asset-pipeline-model.ts` cover the resolver, exact
  accounting, mutation, refusal/no-write, and no-view-time-request properties.
- `test/preflight.test.ts` covers ordered multi-error reports, redaction, count/byte ceilings,
  repeated asset locations, every component kind, chart fallback parity, valid examples,
  CLI/plugin no-write refusal, visible warnings, and trusted-mode disclosure.
- `examples/patterns/portable-mixed.md` plus
  `docs/evidence/renderer/goal-3-portable-assets-2026-08-17.md` retain the real Chromium
  offline mixed-page and loaded-font observations.
- This evidence is one Linux/Chromium observation. It does not certify a supported browser,
  OS, mobile, or assistive-technology cell, and it does not complete the remaining Goal 3
  declarative, token, accessibility, or performance packets.
