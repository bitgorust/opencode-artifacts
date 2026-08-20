# Proposal: Establish the canonical page-quality corpus

## Outcome

The repository contains eight deterministic, permission-safe page-quality bundles that can be
run unchanged through OpenCode and an authorized Claude Code Artifact reference. Each bundle
binds an exact prompt and source material to required and forbidden facts, a reader decision,
interactions, stress cases, licensing, and stable hashes.

## Context

The checked-in pattern examples are renderer regressions, not a controlled same-input corpus.
The normative benchmark requires dashboard, incident, PR walkthrough, system explainer,
comparison, plan/checklist, findings-table, and interactive-decision tasks without selecting
only favorable generations. A frozen corpus is needed before comparative evidence can be
credible or repeatable.

## Scope

- In scope: versioned bundle schema and validator; eight synthetic bundles; exact prompts,
  inputs, facts, decisions, interactions, desktop/mobile stress cases, provenance, licenses,
  content hashes, and fact-normalized renderer fixtures; deterministic mutation/refusal tests.
- Out of scope: Claude account access, model runs, reviewer scores, redistributing private or
  ambiguously licensed output, changing the benchmark threshold, or claiming parity.

## Risks and rollback

- Risk: a fixture may leak private material, encode a preferred system's output, or be too
  ambiguous for factual/hard-gate scoring.
- Rollback: reject the bundle before capture, retain prior corpus versions by hash, and amend
  and reapprove this packet if a post-freeze correction changes facts or decisions.

## Validation plan

Schema and snapshot tests validate all eight task IDs, complete facts/interactions/stress
cases, safe relative paths, byte bounds, hashes, licenses, and renderer preflight. Independent
manual review confirms each prompt is system-neutral and each rubric answer is decidable from
the bundle alone. No reference generation is run under this packet.
