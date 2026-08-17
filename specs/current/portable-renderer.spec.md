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
- `RENDER-07`: one version-1 `design-tokens` fence supplies prompt-level values and the fixed
  `.opencode/artifact-tokens.json` file supplies project values. The deterministic precedence
  is prompt > project > curated theme > built-in defaults; each effective token records named
  provenance in portable-page metadata. Invalid higher sources are rejected atomically before
  permission or writes, while standalone rendering shows an escaped fallback.
- `SEC-04`: token sources are capped at 8 KiB, project discovery refuses worktree/file/parent
  symlinks and non-regular files, and values are restricted to six-digit colors plus fixed
  font, spacing, radius, and density enums. Effective text/accent pairs are contrast checked;
  deterministic output populates only fixed CSS variables and leaves the CSP unchanged. Raw
  CSS, selectors, declarations, URLs, markup, imports, expressions, and arbitrary font stacks
  are not an authoring surface.
- `SEC-02`: resolution is independent of process cwd after the caller supplies its worktree
  root. It checks every path segment, opens regular files without following the final symlink,
  compares descriptor identity across a bounded read, repeats realpath containment, detects
  MIME from bytes, and never fetches.
- `RENDER-06`: pages expose a skip link and header/main landmarks, Unicode-safe anchors,
  meaningful chart/Mermaid equivalents, table captions/filter labels/sort state, progress and
  decision state, visible focus, keyboard decision/comment flows, reduced motion, narrow and
  200%-equivalent reflow, and print behavior. `lang`, `dir`, `locale`, and `timezone` are
  explicit and deterministic; RTL direction can be inferred and numbers/zoned timestamps use
  the declared locale context. Missing equivalents and invalid metadata refuse publication.
- `QUAL-04`: semantic tests and retained Chromium desktop, 390-pixel dark/reduced-motion, and
  200%-equivalent RTL evidence are green. Manual screen-reader evidence is unavailable in the
  current environment, so accessibility certification and the packet archive gate remain open.

## Limits

| Boundary | Default |
|---|---:|
| Markdown source | 1 MiB |
| Declared assets | 64 |
| One decoded asset | 4 MiB |
| All decoded assets | 10 MiB |
| One project or prompt design-token source | 8 KiB |
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
- `test/design-tokens.test.ts` covers schema aggregation, precedence, provenance, atomic
  fallback, contrast, hostile values, project file/symlink/byte boundaries, deterministic
  serialization, standalone fallback, and real CLI/plugin no-write/application paths.
- `examples/patterns/design-tokens.md` plus
  `docs/evidence/renderer/goal-3-design-tokens-2026-08-17.md` retain the offline Chromium 151
  desktop/mobile computed-style, provenance, CSP, console, request, overflow, and screenshot
  observations.
- `examples/patterns/portable-mixed.md` plus
  `docs/evidence/renderer/goal-3-portable-assets-2026-08-17.md` retain the real Chromium
  offline mixed-page and loaded-font observations.
- `test/accessibility.test.ts`, the served-bridge regression in `test/serve.test.ts`, and
  `examples/patterns/accessibility-rtl.md` cover semantic equivalents, contrast, Unicode,
  locale/time-zone/RTL output, keyboard state, reduced motion, reflow, and print behavior.
  `docs/evidence/renderer/goal-3-accessibility-2026-08-17.md` retains the Chromium 151
  accessibility-tree, keyboard, desktop/mobile/zoom, console, request, and screenshot results.
- This evidence is one Linux/Chromium observation. It does not certify a supported browser,
  OS, physical mobile device, or assistive-technology cell. The screen-reader gate and Goal 3
  performance packet remain incomplete.
