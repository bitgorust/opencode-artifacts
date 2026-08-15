# Engineering Principles

The rulebook for this repository. Every rule cites its source. `scripts/check-repo.ts`
enforces the machine-checkable subset; CI runs it on every push.

## 1. Intent and scope

- Ship the smallest change that satisfies the explicit request; park "could also improve X"
  in a closing note, not in the diff. (karpathy-guidelines, repo-local skill)
- Commit to one approach; reopen only on contradicting evidence. (karpathy-guidelines)
- Every claim of "done" rests on tool output from the same session — tests actually run,
  pages actually rendered. "Should pass" is not verification.
  (superpowers `verification-before-completion` skill)
- User-visible output is verified through its real surface: pages in a browser, CLI by
  running it, publishers against a fake runner plus one real deploy per new target.
  (this repo's QA history: every surfaced bug — CSP/eval, script ordering, state races —
  came from browser QA, not unit tests)

## 2. Code

- Strict TypeScript: no `as any`, no `@ts-ignore`/`@ts-expect-error`, no non-null assertion
  where a real check exists. (`tsc strict`, enforced by check-repo grep)
- Errors are typed (`ArtifactTooLargeError`, `StaleArtifactError`) and surfaced with
  actionable messages — what failed and what to do next.
- Silent catch only where the operation is genuinely best-effort: client-side
  `localStorage` persistence inside the artifact BOOT string, and tolerated remote
  operations during deploy (pull-before-push, Pages-enable retry). Everything else must
  propagate or be returned.
- Substrate constraints of this environment: Node 24 type stripping runs the tests, so no
  constructor parameter properties; `.ts` import specifiers with
  `rewriteRelativeImportExtensions` so the same sources compile to `dist/`.

## 3. Architecture

- Pipeline separation: **capture → author (Markdown) → render (fixed) → publish
  (interface)**. The renderer never trusts the model; publishers never touch markup.
  (`docs/superpowers/specs/2026-08-14-opencode-artifacts-design.md`)
- New capabilities join as a component fence, a Publisher, or a serve/hosted endpoint —
  not as branches inside existing units.
- The model authors declarative specs; arbitrary per-page JS lives only in `format: "html"`
  mode, which visibly opts out of renderer guarantees.
  (docs/component-spec.md; Claude Code's "capture of work, not an application")

## 4. Security invariants — each must have a test

- `markdown-it` with `html: false`; raw HTML never passes through Markdown mode.
- CSP on every emitted page: `default-src 'none'; script-src 'unsafe-inline';
  style-src 'unsafe-inline'; img-src data:; connect-src 'none'`. Served/hosted copies may
  relax `connect-src` to `'self'`; the on-disk file never changes. (`src/served-html.ts`)
- No `unsafe-eval`, ever — charts run through vega's `ast: true` interpreter.
  (regression-locked after browser QA caught the eval violation)
- Chart JSON is `\u003c`-escaped inside `<script>` payloads. (XSS breakout test)
- 15 MiB rendered cap, enforced before any write.
- Credential-pattern scan blocks publish unless `force`. (`src/guard.ts`)
- Local state directories (`.state`, `.db`, `.datasources`) never leave the machine —
  both hosted publishers exclude them by test.
- Datasources are registered at publish time by the session; viewers can only poll
  registered names. (no viewer-defined commands)

## 5. Testing

- `node --test` only, no framework. One behavior, one test. (superpowers TDD skill)
- New behavior lands with its test in the same commit.
- Tests must not depend on network, clocks beyond millisecond ordering, or machine paths
  outside tmpdir. External commands go through the injectable `Runner`.
- Browser QA with a screenshot is required evidence for any change to emitted HTML/CSS/JS;
  screenshots land in `docs/evidence/`.

## 6. Documentation

- README follows the collected conventions: funnel order (what → demo → install → usage →
  limits → license last), one-liner < 120 chars matching `package.json` description and the
  GitHub repo description, TOC past 100 lines, repo-local images, judicious badges.
  Sources: [Art of README](https://github.com/hackergrrl/art-of-readme),
  [Standard Readme](https://github.com/RichardLitt/standard-readme/blob/main/spec.md),
  [Make a README](https://www.makeareadme.com/),
  [Open Source Guides](https://opensource.guide/starting-a-project/),
  [GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes).
- Docs name versions only via git tags; body text describes behavior, not version numbers
  that rot. (learned: comparison doc pinned "v0.3.0" and went stale within two releases)
- Every claimed capability in docs links to evidence: a test, an example file, or a
  screenshot.

## 7. Versioning and commits

- [SemVer](https://semver.org/): breaking authoring-format or tool-arg changes → minor at
  minimum until 1.0, then major.
- [Conventional Commits](https://www.conventionalcommits.org/), atomic: one concern per
  commit.
- Never commit secrets; the guard patterns in `src/guard.ts` apply to our own repo too.

## 8. Packaging and distribution

- Follow the [OpenCode plugin docs](https://opencode.ai/docs/plugins/): named plugin
  function export, npm-installable with runtime deps declared in `dependencies`,
  `@opencode-ai/plugin` as peer + dev.
- `npm pack` contents are reviewable: `files` covers `dist`, `skills`, README, LICENSE;
  `main`/`types`/`repository`/`keywords` present. (checked by check-repo + CI pack dry-run)
- Install docs must cover both the registry path and a non-registry path (file: spec),
  matching what OpenCode actually accepts.

## 9. Dependencies

- Default to zero new dependencies. Heavy browser runtimes (vega, echarts, mermaid) are
  allowed only because they inline conditionally into pages; a new one must justify its size
  the same way.
- No dependency may introduce network calls at page view time (CSP model).

## 10. Automation that keeps this true

- `.github/workflows/ci.yml` on every push/PR: install, build, test, `check-repo`,
  `npm pack --dry-run`.
- `npm run check` locally runs the same structural assertions before you push.
