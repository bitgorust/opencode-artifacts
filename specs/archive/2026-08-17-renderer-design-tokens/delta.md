# Specification delta: Add bounded renderer design tokens

## MODIFIED

### Requirement: RENDER-07

Renderer design tokens use a versioned allowlisted schema and deterministic precedence:
explicit prompt values override the project token file, which overrides a curated theme and
built-in defaults. Each source records provenance; invalid higher-precedence input refuses or
falls back explicitly and no token source can execute code.

#### Scenario: Normal behavior

- **Given:** valid values at prompt, project, theme, and default levels
- **When:** tokens resolve
- **Then:** each emitted CSS variable has the highest-precedence value and named provenance

#### Scenario: Failure or refusal

- **Given:** an unknown token, unsafe value, invalid contrast pair, or oversized file
- **When:** project tokens load
- **Then:** the source is rejected with no partial application or executable output

#### Scenario: Relevant boundary

- **Given:** the same valid token set on different platforms
- **When:** CSS variables are generated
- **Then:** ordering and bytes are deterministic while system-font fallback remains explicit

### Requirement: SEC-04

Markdown design configuration accepts data values only: no selectors, declarations, URLs,
markup, script, imports, expressions, or raw CSS. Values are parsed by type and emitted through
fixed CSS-variable slots without changing the strict CSP.

#### Scenario: Normal behavior

- **Given:** allowlisted colors, spacing, radius, density, and font-stack identifiers
- **When:** the style block is generated
- **Then:** only fixed property templates receive validated serialized values

#### Scenario: Failure or refusal

- **Given:** a token contains CSS/script breakout or a remote URL
- **When:** schema validation runs
- **Then:** rendering refuses the token source and the payload remains inert text

#### Scenario: Relevant boundary

- **Given:** trusted HTML mode also supplies page styles
- **When:** metadata is produced
- **Then:** trusted code remains explicitly distinguished from bounded Markdown tokens
