# Proposal: Add bounded renderer design tokens

## Outcome

Portable pages accept a bounded declarative token set with precedence prompt > project file >
curated theme > built-in defaults, without accepting CSS, URLs, markup, or executable values.

## Context

Curated themes exist, but projects cannot safely express a consistent visual system and prompt
choices do not have a formal precedence contract. Arbitrary CSS would weaken CSP, portability,
and predictable accessibility.

## Scope

- In scope: versioned token schema, allowlisted color/type/spacing/radius/density values,
  bounded project discovery, prompt overrides, provenance, contrast validation, and deterministic
  CSS-variable emission.
- Out of scope: arbitrary CSS, JavaScript, remote fonts/assets, selectors, layout escape
  hatches, or unbounded token names.

## Risks and rollback

- Risk: hostile token strings could break style/script boundaries or create inaccessible
  contrast and cross-platform font drift.
- Rollback: ignore/refuse the invalid source and fall back to the last lower-precedence valid
  theme without changing stored artifact identity.

## Validation plan

Schema boundary tests, injection strings, precedence fixtures, contrast checks, and retained
desktop/mobile screenshots must show deterministic bounded output and useful fallback.
