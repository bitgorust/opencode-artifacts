# Governance policy and current evidence

## Canonical records

- `docs/governance-policy.json` is the machine-validated status record. The canonical prose
  policies are `docs/support-policy.md`, `docs/security.md`, `docs/data-governance.md`,
  `docs/threat-model.md`, and public `SECURITY.md`.
- Missing, separately scoped, or failed evidence cannot become supported/readiness state.
  The deterministic repository check enforces required platform cells, data modes, threat
  boundaries, provider prerequisites, Node floor, and high-level README claim consistency.

## Current decisions

- `COMPAT-01`: Node 24 is the support floor. Target coverage is Ubuntu 24.04 LTS, current and
  previous macOS, Windows 11 native/WSL, current and oldest-supported stable OpenCode 1.x,
  latest-two desktop Chromium/Firefox/Safari and mobile Android Chrome/iOS Safari where
  available. There are zero supported complete cells; all target cells are unverified.
- `SEC-01`: current, partial, and planned trust boundaries have owners, threats, controls,
  tests, residual risk and review triggers. Planned identity/connectors do not become shipped.
- `SEC-10`: private GitHub vulnerability reporting is disabled, so sensitive private intake
  is unavailable and production readiness fails. Severity/response, rotation and compromised-
  release processes are published for use after an accountable private path is operational.
- `PRIV-01`–`PRIV-07`: the mode inventory and governance policy separate local, loopback,
  user-operated public targets, planned authenticated/connectors, journey studies and release
  evidence. Local creation has no default project telemetry. Provider-wide erasure, residency,
  backups, SLA, legal compliance and project-operated hosting are not claimed.
- `DIST-03`–`DIST-07`: only the current package minor receives fixes; deprecations receive at
  least one supported-release notice except active exploits. D-06 selects npm trusted
  publishing/provenance, npm CycloneDX, audit/signatures, license disposition and exact packed-
  byte binding. The dated provider report verifies the then-current published release for its
  own tag/commit; trusted-
  publisher configuration and future-candidate provenance are not. Current audit, signature,
  license, provider and platform evidence fails or is incomplete, so no production-readiness
  claim is permitted.
