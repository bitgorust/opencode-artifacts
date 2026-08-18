# Specification delta: Add responsive visual composition

## MODIFIED

### Requirement: RENDER-06

Composition primitives preserve DOM reading/focus order across visual layouts, reflow without
loss at 200% equivalent zoom, respect reduced motion and color modes, and retain semantic labels.

#### Scenario: Normal behavior
- **Given:** a split, full-bleed, annotated, or dense composition
- **When:** it is used by keyboard or assistive technology
- **Then:** landmarks, reading order, focus, names, states, and contrast remain coherent

#### Scenario: Failure or refusal
- **Given:** a declaration would hide content or make visual order contradict semantic order
- **When:** preflight validates it
- **Then:** publication is refused before permission or writes

#### Scenario: Relevant boundary
- **Given:** 200% equivalent zoom, RTL text, long labels, or reduced motion
- **When:** the page renders
- **Then:** content reflows without overlap, clipping, lost function, or motion dependency

### Requirement: RENDER-09

Bounded task-aware hierarchy, density, scale, card emphasis, and narrative rhythm variants use
space intentionally and avoid accidental dead zones, undersized primary visuals, and uniform templates.

#### Scenario: Normal behavior
- **Given:** any normalized core-corpus task
- **When:** its recommended composition is rendered at desktop width
- **Then:** the primary finding and decision lead an intentional task-specific hierarchy

#### Scenario: Failure or refusal
- **Given:** a primary visual occupies less than half a full-width card with unexplained empty space
- **When:** layout hard gates run
- **Then:** the sample fails even if its remaining visual score is high

#### Scenario: Relevant boundary
- **Given:** dense and quiet variants use identical underlying facts
- **When:** they render
- **Then:** both remain readable and materially distinct without changing or hiding facts

### Requirement: RENDER-10

Charts, diagrams, media/mockups, comparisons, diffs, and annotations size to their container and
switch to defined narrow-screen compositions instead of shrinking a fixed desktop canvas.

#### Scenario: Normal behavior
- **Given:** a supported visual inside a full, split, or framed composition
- **When:** its container or viewport changes
- **Then:** it uses available width, preserves labels, and reflows according to the declared primitive

#### Scenario: Failure or refusal
- **Given:** a fixed dimension or invalid combination would overflow the portable page
- **When:** preflight or runtime layout validation runs
- **Then:** it is refused or uses the documented safe linear fallback without horizontal scroll

#### Scenario: Relevant boundary
- **Given:** a 390x844 viewport with long labels and an interactive control
- **When:** the page recomposes
- **Then:** the narrative becomes a logical single-column order with readable visuals and operable controls

### Requirement: QUAL-04

Every new composition is exercised through the real portable page at desktop/mobile widths,
supported modes, keyboard-only, accessibility tooling, manual screen reader, and zero-error console.

#### Scenario: Normal behavior
- **Given:** the eight checked-in normalized fixtures
- **When:** the browser evidence suite and manual checklist run
- **Then:** screenshots, accessibility state, interactions, overflow, requests, and console results are retained

#### Scenario: Failure or refusal
- **Given:** any viewport clips, scrolls unexpectedly, misorders focus, or emits a runtime error
- **When:** evidence is evaluated
- **Then:** the affected composition remains unverified and blocks the packet

#### Scenario: Relevant boundary
- **Given:** automated accessibility checks pass
- **When:** no named manual screen-reader run exists
- **Then:** QUAL-04 remains incomplete rather than inferred from automation
