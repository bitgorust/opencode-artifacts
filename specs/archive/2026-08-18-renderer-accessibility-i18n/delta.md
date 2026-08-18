# Specification delta: Complete renderer accessibility and internationalization

## MODIFIED

### Requirement: RENDER-06

Built-in pages meet WCAG 2.2 AA with meaningful landmarks/headings, chart summaries, table
captions, control names/states, visible focus, logical keyboard order, 200% zoom/reflow,
reduced motion, supported color modes, Unicode, explicit language/direction, and deterministic
locale/time-zone formatting. Decision/comment conflict and recovery flows are keyboard usable
and announced without relying on color.

#### Scenario: Normal behavior

- **Given:** a representative page opened at desktop/mobile widths with keyboard only
- **When:** the user navigates content, decisions, comments, tables, and theme controls
- **Then:** order, focus, names, states, notices, and reflow remain operable and understandable

#### Scenario: Failure or refusal

- **Given:** a chart lacks a meaningful author summary or data-derived fallback
- **When:** accessibility preflight runs
- **Then:** publication reports the missing semantic equivalent rather than hiding the chart

#### Scenario: Relevant boundary

- **Given:** RTL Unicode content at 200% zoom with reduced motion enabled
- **When:** the page renders and interactive state changes
- **Then:** logical reading order, labels, content, and focus remain intact without clipping

### Requirement: QUAL-04

Accessibility changes retain real-surface desktop/mobile-width, keyboard-only, color-mode,
zoom, reduced-motion, automated WCAG, console, and screenshot evidence. Manual screen-reader
results are mandatory for certification and remain explicitly unavailable rather than inferred
from automation.

#### Scenario: Normal behavior

- **Given:** the declared accessibility fixture matrix and available assistive technology
- **When:** verification runs
- **Then:** exact browser/tool versions, results, screenshots, and manual observations are retained

#### Scenario: Failure or refusal

- **Given:** an automated or manual check fails
- **When:** gate status is reconciled
- **Then:** the affected claim remains failed and content is not removed merely to raise a score

#### Scenario: Relevant boundary

- **Given:** supported browsers or screen-reader access is unavailable
- **When:** implementation diagnostics pass
- **Then:** independent work continues but the corresponding Phase 2/certification evidence stays open
