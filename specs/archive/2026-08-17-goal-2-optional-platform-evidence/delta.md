# Specification delta: Make cross-platform filesystem evidence optional for Goal 2

## MODIFIED

### Requirement: COMPAT-01

The target support matrix remains Ubuntu 24.04 LTS, current and previous macOS, Windows 11
native/WSL, supported OpenCode, and named browser generations. Goal-specific implementation
gates may explicitly treat an unavailable target-platform observation as optional when a human
approves that narrower gate, provided the cell remains unverified, no support/certification is
claimed, and platform-dependent behavior remains opt-in or disabled there.

#### Scenario: Normal behavior

- **Given:** Goal 2's technical gate passes on Node 24 and an observed Ubuntu/ext4 filesystem
- **When:** the approved optional-platform rule is applied
- **Then:** Goal 2 and Phase 1 may complete while unavailable macOS and Windows cells remain
  explicitly unverified and schema 2 remains opt-in
#### Scenario: Failure or refusal

- **Given:** an unverified platform cell has no retained result
- **When:** compatibility or certification status is evaluated
- **Then:** the optional goal evidence cannot be promoted to a pass, support claim, or default
  schema enablement

#### Scenario: Relevant boundary

- **Given:** a later goal or release gate explicitly requires the full target matrix
- **When:** that gate is evaluated
- **Then:** Goal 2's narrow waiver supplies no inherited evidence and the later gate remains open
