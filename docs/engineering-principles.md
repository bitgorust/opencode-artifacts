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
  `localStorage` persistence inside the artifact BOOT string; tolerated remote operations
  during deploy (pull-before-push, Pages-enable retry); and absent-or-unreadable *optional*
  resources (config files, state stores, caches) that fall back to a documented default.
  Everything else must propagate or be returned.
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
- Stale-version refusals must carry the live content back (head + body, capped) so the
  session can merge and republish in one step — the autoread-recovery pattern.
  (Claude Code 2.1.232 stale-version guard)
- Interactive elements must have visible `:focus-visible` states; respect
  `prefers-reduced-motion` if motion is ever added.
  (Claude Code artifact-design skill, "Build cleanly")
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
- Chart guidance is honesty-first: title the finding, not the axes; encodings must not
  exaggerate; summarize large datasets instead of inlining them. (Claude Code dataviz skill
  callout + token-cost guidance)
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

## 11. Agent-facing guidance (skills, AGENTS.md, tool descriptions)

Sources: [Anthropic — Equipping agents with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills),
[Anthropic — Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices),
[Anthropic — Lessons from building Claude Code](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills),
[OpenAI — A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf),
[OpenAI Codex — AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md),
[agents.md](https://agents.md/),
[GitHub — agents.md lessons from 2,500 repos](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/).

- **Progressive disclosure is the load-bearing structure.** Metadata (~50 tokens, always
  loaded) → SKILL.md body (< 500 lines, loaded when relevant) → reference files loaded on
  demand, linked **one level deep** from SKILL.md (nested references get partial reads).
  Reference files over 100 lines carry a table of contents. (Anthropic, both sources)
- **A description is a trigger contract, not a summary**: what it does + when to use it +
  phrases a user would actually say. Written for the model scanning a skill list, not for
  humans browsing. Same contract governs our tool descriptions (`artifact_publish` reads as
  when-to-publish guidance, not API docs). (Claude Code lessons; Anthropic checklist)
- **Never state the obvious** — the model already knows how to code and read a repo. Skill
  content exists to push it out of its default behavior. The highest-signal section is
  **gotchas**, grown from observed failures over time — ours include "BOOT runs before the
  serve snippet is injected" and "area charts need clip: true under layered marks".
  (Claude Code lessons)
- **Inform, don't railroad**: give the model what it needs and leave adaptation room; skills
  get reused in contexts you didn't foresee. (Claude Code lessons)
- **Scripts beat prose for deterministic work**: a validator that runs is better than
  instructions describing validation. Our `scripts/check-repo.ts` is this principle applied
  to ourselves. (Anthropic best practices)
- **One agent first; split only on demonstrated complexity** — conditional-laden prompts or
  overlapping tools are the split signals, not aesthetics. We ship one skill, not eleven.
  (OpenAI practical guide)
- **High-risk actions get human checkpoints** — our `ctx.ask` publish prompt and the guard
  `force` gate are the intervention points; never route around them silently. (OpenAI
  guardrails)
- **AGENTS.md is for agents what README is for humans**: commands early (with flags),
  concrete examples over prose, stack with versions, and three-tier boundaries
  (always / ask first / never). Nearest file wins on conflict. (agents.md; GitHub study)
- **When the agent makes the same mistake twice, retrospective → update the guidance.** Rules
  grow from real friction, not upfront anticipation. (OpenAI Codex best practices)

### Context engineering for the current model generation

Sources: [Anthropic — Effective context engineering for AI agents (2025-09)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
[Anthropic — New rules of context engineering (2026-07)](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models),
[Anthropic Cookbook — Memory, compaction, and tool clearing (2026-03)](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools),
[LangChain — Context engineering for agents (2025-07)](https://www.langchain.com/blog/context-engineering-for-agents),
[tianpan.co — Four strategies, with benchmarks (2026-02)](https://tianpan.co/blog/2026-02-28-four-strategies-agent-context-engineering),
[Anthropic — The unreasonable effectiveness of HTML (2026-05)](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html).

**The master principle**: context is a finite attention budget subject to context rot; find
the smallest set of high-signal tokens that maximize the likelihood of the desired outcome.
Everything we inject into a session — tool descriptions, skill bodies, proactive guidance,
artifact content returned by tools — is audited against this. (Anthropic 2025-09)

Applied to this repo:

- **Judgment over rules; expressive interfaces over examples.** Anthropic removed 80% of
  Claude Code's system prompt with no eval loss. Add a rule when a failure is observed;
  re-evaluate rules when the harness model generation changes. Two held tensions: GitHub's
  agents.md study says code examples beat explanations (true for style/persona), while
  Anthropic says examples constrain tool exploration (true for tool surfaces — our enum-typed
  args and digest/verbose flags do this). (2026-07)
- **Altitude**: specific enough to guide, flexible enough to adapt — no brittle if-else
  logic, no vague aspiration. Applies to every description we ship. (2025-09)
- **One fact, one home**: the tool description owns how, the skill owns when/why, AGENTS.md
  owns repo facts. Repetition was an old-model workaround; deleted here. (2026-07)
- **Just-in-time over front-loading**: lightweight identifiers in context (paths, slugs,
  hashes), content loaded on demand — our `reference/` files, capped 16 KB stale-guard
  preview, and `digest: true` comment triage all follow this. (2025-09)
- **Token-efficient tool returns**: compact pointers by default (path + hash), full content
  only on explicit request; evidence shows observation masking beats summarization (~50% cost
  cut on SWE-bench-class workloads) — large returns must justify themselves. (2026-02)
- **Durable external state over in-context accumulation**: our artifact pages are rich
  references for later sessions (better than prose specs), and `.state`/`.db` stores double
  as agent scratchpads that survive compaction and session resets. Compaction/memory/
  sub-agent strategy belongs to the harness; our job is to be good storage. (2025-09, 2026-05)
- **Prefix stability is a feature**: the proactive injection is a static string computed once
  at plugin init, never rebuilt per turn — reordering or rebuilding context silently breaks
  prompt caching. (2026-02)
- **Anti-patterns we refuse**: whole-document dumps into context, unbounded transcripts,
  stale memory without a supersede path, deferred-loading nothing. (2026-05 guide)
