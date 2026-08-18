# Proposal: Complete renderer accessibility and internationalization

## Outcome

Built-in pages expose semantic landmarks, summaries, labels, logical keyboard order, visible
focus, reduced-motion behavior, 200% zoom resilience, Unicode/locale/RTL correctness, and
accessible decision/comment workflows through the real browser surface.

## Context

The shell has responsive styling and keyboard-capable controls, but Phase 2 requires a complete
audited contract for charts, tables, forms, comments, color modes, motion, bidirectionality,
dates/numbers, and degraded states. Automated checks cannot substitute for manual assistive
technology evidence.

## Scope

- In scope: landmarks/headings, chart text summaries, table captions, control names/states,
  skip/focus order, keyboard flows, contrast, zoom/reflow, reduced motion, `lang`/`dir`, Unicode,
  locale/time-zone formatting, and print/PDF only where behavior can be justified and tested.
- Out of scope: claiming every author-supplied fact/alt text is correct, broad platform support,
  or passing manual screen-reader/mobile evidence that was not collected.

## Risks and rollback

- Risk: visually hidden content can diverge from charts; focus repair can disrupt reading order;
  locale defaults can make output nondeterministic.
- Rollback: retain semantic static summaries and native document order while disabling only the
  faulty enhancement; never remove content to make an automated score pass.

## Validation plan

Automated WCAG tooling, semantic assertions, keyboard-only desktop/mobile-width workflows,
200% zoom, reduced-motion, LTR/RTL/Unicode/locale fixtures, console checks, screenshots, and
retained manual screen-reader results or an explicit unavailable gate.
