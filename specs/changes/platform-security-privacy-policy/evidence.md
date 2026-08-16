# Evidence: Publish platform, security, privacy, and release policy

This draft records known evidence state; links are added only after approved artifacts exist.

## Requirement: SEC-01
- Validation: pending accountable security review.
- Verification: no versioned threat model exists.
- Result: missing.

## Requirement: SEC-10
- Validation: pending response-policy review.
- Verification: GitHub private vulnerability reporting returned `enabled: false` on 2026-08-16.
- Result: fail; there is no verified private reporting path.

## Requirement: PRIV-01
- Validation: pending privacy review.
- Verification: no versioned mode-specific data inventory exists.
- Result: missing.

## Requirement: PRIV-02
- Validation: pending policy review.
- Verification: current code audit and tests must prove no default telemetry after approval.
- Result: pending.

## Requirement: PRIV-03
- Validation: pending policy review.
- Verification: existing secret/publication tests are incomplete evidence until mapped to every output boundary.
- Result: partial.

## Requirement: PRIV-04
- Validation: pending operator disclosure review.
- Verification: target-specific operator/region/recipient disclosure is incomplete.
- Result: missing.

## Requirement: PRIV-05
- Validation: pending deletion-consequence review.
- Verification: mode-specific list/export/correct/delete and backup-expiry evidence is absent.
- Result: missing.

## Requirement: PRIV-06
- Validation: pending evidence-retention review.
- Verification: no canonical minimization and retention policy exists.
- Result: missing.

## Requirement: PRIV-07
- Validation: pending public abuse/IP review.
- Verification: no canonical reporting/takedown policy exists.
- Result: missing.

## Requirement: COMPAT-01
- Validation: pending support-scope approval.
- Verification: OpenCode 1.18.18 has dated Ubuntu-local evidence; required macOS, Windows, browser, mobile, and second-host evidence is unavailable.
- Result: fail for the target matrix.

## Requirement: DIST-03
- Validation: pending release-policy review.
- Verification: SemVer and Conventional Commit practice exist, but canonical claim/limits/evidence release policy is incomplete.
- Result: partial.

## Requirement: DIST-04
- Validation: pending D-06 approval.
- Verification: publish workflow requests npm provenance; no retained SBOM, vulnerability/license output, or registry-side attestation verification exists.
- Result: partial and insufficient.

## Requirement: DIST-05
- Validation: pending dependency/license policy review.
- Verification: lockfile exists; complete license/network/CSP/removal disposition is absent.
- Result: partial.

## Requirement: DIST-06
- Validation: pending support-window approval.
- Verification: supported-version, deprecation, vulnerability-response, and end-of-life policy is absent.
- Result: missing.

## Requirement: DIST-07
- Validation: pending attribution policy review.
- Verification: repository license exists; a complete documentation/assets/font/reference inventory is absent.
- Result: partial.
