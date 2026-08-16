# Proposal: Publish platform, security, privacy, and release policy

## Outcome

Users and release maintainers can determine exactly which platforms and capabilities are
supported, what data each mode handles, how security/privacy reports and deletion work, and
which supply-chain evidence is required; unverified combinations and missing external setup
remain visibly unsupported.

## Context

Phase 0 has no support matrix, threat model, data inventory, telemetry/retention/deletion or
abuse policy, private vulnerability path, supported-version policy, or accepted supply-chain
decision. That makes `D-01` and `D-06` open and prevents honest release claims. Current dated
facts are narrower than the target: OpenCode 1.18.18 is both the locally verified and registry
stable version as of 2026-08-16; CI targets Node 24 on Ubuntu; the current shell is Node 18 and
is not platform evidence; macOS, Windows, Safari, mobile, and a second stable host have not
been run; GitHub private vulnerability reporting is disabled; and the publish workflow asks
npm for provenance but its registry-side trusted-publisher result has not been verified.

## Scope

- In scope: one dated support matrix separating target, tested, supported, unsupported, and
  unverified states; D-01 policy and update trigger; a versioned threat model; a capability-
  and mode-specific data inventory; no-default-telemetry statement; retention, deletion,
  disclosure, public abuse/takedown, and evidence-data rules; `SECURITY.md`; severity,
  response, rotation, and compromised-release playbooks; current-minor support/deprecation/
  end-of-life policy; D-06 choice of npm trusted publishing, CycloneDX JSON SBOM, vulnerability
  and license disposition; exact status reconciliation across README and contract docs.
- Out of scope: claiming tests on unavailable OS/browser combinations; enabling hosted or
  connector capabilities; promising legal compliance or residency; inventing an email or
  response team; changing the CSP, Publisher interface, plugin tool arguments, package version,
  or npm/GitHub settings without explicit authority; releasing or deleting packages.

## Risks and rollback

- Risk: documentation could overstate unrun platforms, imply service-operator guarantees for
  user-operated targets, expose report contents, promise unstaffed response times, or treat
  generated SBOM/provenance as proof that dependencies are safe. Narrow support may reveal
  that the current published package lacks a production-readiness claim.
- Rollback: revert the policy documents and release automation before any new claim, keeping
  prior evidence and failures. External enablement (private vulnerability reporting or npm
  trusted publishing) requires a separate authorized checkpoint and is reversed in provider
  settings only by an authorized maintainer. No user data is migrated by this packet.

## Validation plan

Accountable maintainers review and approve the supported scope, controller/operator wording,
retention/deletion consequences, security response targets, license rules, and current-minor
support window. Verification includes deterministic claim/status checks, threat-model
coverage, repository secret scanning, license/vulnerability/SBOM dry runs, package inspection,
and dated real host/browser results for every supported matrix cell. Provider settings and
published provenance are recorded only after authorized real checks. Any missing platform,
private-reporting configuration, or provenance result remains failed/unverified and blocks
the Phase 0 gate rather than being inferred from workflow configuration.
