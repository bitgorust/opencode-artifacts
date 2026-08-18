# Page-quality benchmark

Status: Normative evaluation method

Last reviewed: 2026-08-15

## Purpose

`opencode-artifacts` targets page quality equal to or better than current Claude Code
Artifacts for the same task and source material. This is a user-perceived outcome, not a
promise that our renderer copies Anthropic's visual style.

The product spec's correctness, accessibility, CSP, and portability requirements remain hard
floors. A beautiful page that misstates the data, breaks on mobile, or needs undeclared
network access does not pass. Conversely, satisfying those engineering floors does not prove
visual parity.

## What is compared

The primary benchmark compares the artifact **content surface**: the page below the hosting
product's navigation/share chrome. Hosting chrome, gallery, sharing, and version controls are
evaluated separately under the hosting requirements.

Two tracks prevent a single score from hiding the source of a gap:

1. **End-to-end product track:** give Claude Code and OpenCode the same prompt, repository or
   data bundle, required facts, and interaction goal. This measures selection, authoring,
   rendering, and polish together.
2. **Renderer track:** render a checked-in, fact-normalized fixture through our declarative
   pipeline. This measures layout and component quality without rewarding or penalizing model
   variation. It is a regression track, not a substitute for the end-to-end comparison.

Raw-HTML pages may be reported as an additional ceiling, but they do not satisfy the fixed
renderer's parity gate. The ordinary Markdown/component path must carry the core corpus.

## Reference sources

Reference material is ranked to avoid building a target from cherry-picked third-party work:

1. **Current same-input Claude Code outputs.** These are the primary comparative baseline.
   Capture them through a properly licensed, authenticated Claude subscription using the
   current supported CLI and Artifact feature.
2. **Official Anthropic material.** The
   [Artifact guide](https://code.claude.com/docs/en/artifacts),
   [launch demonstration](https://www.youtube.com/watch?v=m7TJqx8CYG8) define the initial
   task families and visible quality bar. These are link-only references; their media is not
   copied into this repository without recorded redistribution authority.
3. **Public community examples.** These may reveal useful patterns, but are supplemental
   because selection bias, unknown prompts, manual editing, and uncertain provenance make
   them unsuitable as pass/fail references.

Every reference capture records the date, Claude Code version, model when visible, plan or
organization class, prompt, source fixture commit, viewport, color mode, and whether a human
edited the result. Private artifact contents are not committed without authorization.

Without current same-input Claude outputs, the project may say that it covers the official
pattern corpus; it MUST NOT claim equal-or-better page quality.

## Core corpus

The corpus uses official Claude Code examples and patterns, adapted into deterministic,
permission-safe fixtures:

| ID | Artifact task | Required visual work |
|---|---|---|
| `dashboard` | Operational or product KPI dashboard | metric hierarchy, primary chart, breakdown, finding, provenance |
| `incident` | Investigation timeline/postmortem | status, chronology, suspect change, trend, root cause, next actions |
| `pr-walkthrough` | Annotated change review | severity, code/diff context, annotations, tests, verdict |
| `system-explainer` | Architecture or data-flow explanation | labeled relationships, sequence, boundaries, one clear narrative |
| `compare` | Design or implementation alternatives | genuinely distinct variants, consistent comparison, tradeoffs |
| `plan-checklist` | Implementation/release plan | progress, owners or states, dependencies, risks, scannable next step |
| `findings-table` | License/security/cost findings | prioritization, sortable detail, exceptions, provenance |
| `interactive-decision` | Tune values or decide and return the result | discoverable controls, immediate feedback, reset/export/copy path |

Each fixture includes:

- the exact prompt and source bundle;
- facts that must appear and facts that must not be invented;
- the primary reader and the decision they need to make;
- required interactions and expected state changes;
- intentional stress cases: long labels, missing values, dense data, and narrow viewport.

Run at least three independent end-to-end generations per system and task. Do not select only
the best generation. A release report may use fewer exploratory runs while building the
benchmark, but cannot make the equal-or-better claim from them.

## Capture protocol

- Use the same underlying model family and comparable reasoning settings when both hosts
  support them. Record unavoidable differences.
- Capture the settled initial state at desktop (1440 × 900) and mobile (390 × 844). Capture
  light and dark modes when the page supports both.
- Randomize system labels and crop product-specific chrome for the content-surface review.
- Exercise every required interaction by keyboard and pointer; capture the resulting state.
- Record console errors, failed assets, overflow, clipping, horizontal scrolling, and layout
  shift. A visually pleasing screenshot does not erase a runtime defect.
- Keep the prompt, fixture, screenshots, interaction trace, rubric scores, and report under a
  dated `docs/evidence/page-quality/` directory when permissions allow.

## Hard gates

Every OpenCode candidate must meet these before comparative scoring:

- all required facts and interactions are present and no unsupported fact is invented;
- no overlap, clipping, unreadable label, broken asset, accidental horizontal scroll, or
  unexpected console error at either viewport;
- a primary chart or diagram uses the available composition intentionally: it does not occupy
  less than half of a full-width card while leaving the rest as unexplained blank space;
- headings, reading order, focus order, labels, contrast, reduced-motion behavior, and
  keyboard operation satisfy `RENDER-06`;
- visual encodings and axes satisfy the data-honesty requirements;
- the page remains useful offline and within the size/performance budgets.

One hard-gate failure fails that sample regardless of its subjective score.

## Blinded rubric

At least three independent reviewers score randomized pairs from 1 (poor) to 5 (excellent).
The panel must include a design/UX reviewer and a domain-appropriate technical reader. An
automated visual judge may supply secondary diagnostics but cannot be the deciding reviewer.

| Dimension | What reviewers judge |
|---|---|
| Task orientation | Can the intended reader understand the situation and next decision quickly? |
| Information hierarchy | Are the headline, evidence, detail, and actions ordered and weighted correctly? |
| Composition and density | Does the page use space deliberately without crowding or accidental dead zones? |
| Typography and readability | Are type scale, measure, contrast, labels, and code/data text comfortable to read? |
| Visual encoding | Do charts, diagrams, color, annotations, and comparisons clarify rather than decorate? |
| Coherence and craft | Does the page feel intentional, distinctive where useful, and internally consistent? |
| Interaction quality | Are controls discoverable, responsive, reversible, and clear about their effect? |
| Responsive adaptation | Does the composition reflow intelligently rather than merely shrink? |

Reviewers also choose an overall result for each pair: OpenCode better, equivalent, or Claude
better, with a short reason.

## Equal-or-better threshold

The claim is allowed only when all of the following hold for a current benchmark run:

1. At least 80% of end-to-end pairs are judged OpenCode better or equivalent overall.
2. No task family has a majority of reviewers judging Claude better.
3. OpenCode's median score is at least Claude's median in every rubric dimension across the
   full corpus.
4. OpenCode's median is at least 4/5 in every dimension, so parity with a weak or failed
   reference cannot lower the absolute bar.
5. All OpenCode samples pass the hard gates; accessibility and factual correctness cannot be
   traded for aesthetic preference.

Report the pair counts, per-dimension distributions, reviewer count, failures, and confidence
limits. Do not collapse the result into one unexplained number.

Re-run the benchmark for a material renderer/design-skill change and at least once per
supported minor release while making the claim. Re-baseline Claude after a material upstream
Artifact design change.

## Current status

`benchmarks/page-quality/v1/` now owns the hash-bound eight-task corpus, frozen benchmark
manifest, and an empty external-run template. The renderer track has dated Chromium evidence
for all 16 desktop/mobile/mode cells: responsive chart/diagram sizing, task-aware composition,
keyboard traces, runtime errors, overflow, clipping, external requests, useful-content timing,
and layout shift pass the local gate. This resolves the previously observed fixed-size
dashboard chart defect for the normalized fixture.

That local result is regression evidence, not a same-input comparison. Authorized current
Claude generations, their account/settings/retention protocol, all 24 unselected pairs, and at
least three independent reviewer distributions remain absent. Official visual material stays
link-only and no synthetic test score enters the benchmark denominator.

Current verdict: **equal-or-better page quality is a target, not yet a verified capability.**
