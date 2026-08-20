# Proposal: Add responsive visual composition

## Outcome

The normal Markdown/component path can produce intentionally varied, task-oriented pages whose
primary visuals use available space at desktop widths and recompose into a readable logical
order at narrow widths, without relaxing CSP, accessibility, or size budgets.

## Context

Goal 3 proved renderer correctness but retained a visible quality gap: primary charts can sit
at a small fixed size inside a wide card, and existing primitives do not express full-bleed,
split, annotated, mockup, dense, or quiet compositions. The benchmark hard gates reject dead
space, clipping, fixed-canvas shrinking, and inaccessible reordering.

## Scope

- In scope: bounded declarative composition primitives, proportional chart/diagram sizing,
  media/mockup and annotation frames, task-aware hierarchy variants, narrow-screen
  recomposition, container-aware output, skill/reference guidance, and real browser evidence.
- Out of scope: raw CSS/HTML passthrough, arbitrary script, remote assets, CSP changes,
  imitating Anthropic's visual identity, or treating screenshots as accessibility proof.

## Risks and rollback

- Risk: new layout vocabulary can create template repetition, reorder content semantically,
  clip long/RTL text, or exceed portable-page budgets.
- Rollback: keep syntax additive, fall back to the existing linear card flow for unsupported
  combinations, and refuse invalid declarations during preflight before publication.

## Validation plan

Component/schema tests cover normal and hostile declarations. All eight normalized corpus
fixtures render offline at 1440x900, 390x844, 200% equivalent zoom, light/dark, reduced motion,
LTR/RTL stress, keyboard interaction, and print. Retained browser evidence records layout,
accessibility tree, overflow, console, network, and byte/performance results; user-visible
changes receive manual screen-reader review before verification.
