# Portable renderer correctness

## Current behavior

- `RENDER-04`: Markdown images published through the CLI or plugin resolve only from the
  explicit project worktree. PNG, JPEG, GIF, WebP, and a conservatively reconstructed SVG
  subset become hashed data URIs. External, absolute, traversal, encoded-separator, missing,
  symlinked, non-regular, mislabeled, active, changed-during-read, or unlabelled image inputs
  fail before the permission prompt or any publication write. An exact image title of
  `decorative` explicitly selects empty-alt presentation semantics.
- `RENDER-04`: optional frontmatter `font:` declarations accept contained WOFF/WOFF2 bytes
  under the same resolver and generate a fixed `@font-face`; the required narrow CSP font
  directive remains pending explicit approval, so font loading is not yet claimed.
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
- `examples/patterns/portable-mixed.md` plus
  `docs/evidence/renderer/goal-3-portable-assets-2026-08-17.md` retain the real Chromium
  offline mixed-page observation.
- This evidence is one Linux/Chromium observation. It does not certify a browser, OS, mobile,
  assistive-technology, or font-loading cell, and it does not complete the remaining Goal 3
  declarative, token, accessibility, or performance packets.
