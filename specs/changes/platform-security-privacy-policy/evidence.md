# Evidence: Publish platform, security, privacy, and release policy

This record separates policy publication from current operational evidence. Failed and
unverified results keep the packet open and block the Phase 0 gate.

## Requirement: SEC-01
- Validation: `bitgorust` approved the boundary set, fail-closed semantics, owner/review
  triggers, and planned-versus-current distinction on 2026-08-16.
- Verification: the versioned threat model covers all ten required current, partial, and
  planned boundaries; deterministic tests reject a missing boundary.
- Result: pass for Phase 0 policy; residual implementation risks remain explicit.
- Evidence: [@test](test/governance-policy.test.ts), [@manual](docs/threat-model.md)

## Requirement: SEC-10
- Validation: the severity, response, disclosure, rotation and compromised-release policy was
  approved on 2026-08-16, including refusal while private intake is absent.
- Verification: GitHub private vulnerability reporting returned `enabled: false` on
  2026-08-16; the public policy exposes that failure and does not solicit sensitive issues.
- Result: fail; there is no verified private reporting path.
- Evidence: [@test](test/governance-policy.test.ts),
  [@manual](docs/evidence/governance/provider-status-2026-08-16.md)

## Requirement: PRIV-01
- Validation: the capability/mode inventory and operator/controller wording were approved on
  2026-08-16.
- Verification: machine validation requires all eight current/planned modes and every purpose,
  operator/recipient, location, sensitivity, retention and deletion field.
- Result: pass for Phase 0 inventory publication.
- Evidence: [@test](test/governance-policy.test.ts), [@manual](docs/data-governance.md)

## Requirement: PRIV-02
- Validation: no-default-telemetry and affirmative opt-in wording was approved on 2026-08-16.
- Verification: code inspection found no project telemetry/analytics path; portable files use
  strict `connect-src 'none'`, while loopback bridge requests exist only when served.
- Result: pass for current local creation; explicit provider deploy remains capability data.
- Evidence: [@test](test/render.test.ts), [@manual](docs/data-governance.md)

## Requirement: PRIV-03
- Validation: secret/output exclusions and narrow override wording were approved.
- Verification: existing guard and deploy tests cover content/title and staged HTML scanning,
  but do not prove every future metadata/evidence/provider boundary.
- Result: partial.
- Evidence: [@test](test/guard.test.ts), [@test](test/plugin.test.ts),
  [@test](test/cloudflare.test.ts)

## Requirement: PRIV-04
- Validation: the user-operator and no-residency/SLA/compliance wording was approved.
- Verification: canonical policies and Cloudflare guide disclose current boundaries, but CLI
  deployment preflight does not yet present the complete inventory before data moves.
- Result: partial.
- Evidence: [@test](test/governance-policy.test.ts), [@manual](docs/hosted-cloudflare.md)

## Requirement: PRIV-05
- Validation: scoped deletion, immutable-history and provider-copy limitations were approved.
- Verification: the policy names current manual paths and explicitly marks provider-wide
  receipts, backup expiry, authenticated and connector operations unavailable.
- Result: partial; policy is published, but bounded end-to-end deletion operations are absent.
- Evidence: [@manual](docs/data-governance.md), [@test](test/governance-policy.test.ts)

## Requirement: PRIV-06
- Validation: minimization, access, retention and withdrawal rules were approved.
- Verification: governance validation covers release/study inventory; journey tests reject
  identity fields and redact participant codes/answers from aggregates.
- Result: partial; broad log/screenshot/support-bundle enforcement is not implemented.
- Evidence: [@test](test/journey-study.test.ts), [@manual](docs/data-governance.md)

## Requirement: PRIV-07
- Validation: user-operator responsibility, attribution and remaining-copy limits were
  approved.
- Verification: a public abuse/IP process is published; no project-operated target or global
  deletion authority is claimed.
- Result: partial; real operator handling and a complete asset inventory remain unverified.
- Evidence: [@manual](docs/data-governance.md),
  [@manual](docs/evidence/governance/supply-chain-2026-08-16.md)

## Requirement: COMPAT-01
- Validation: Node 24, the target OS/browser envelope and exact-evidence promotion rule were
  approved.
- Verification: OpenCode 1.18.18 has dated Linux registration evidence; the exact OS/Node/
  browser journey was not recorded. Every target cell is unverified and there are zero
  supported complete cells.
- Result: fail for the target matrix.
- Evidence: [@test](test/governance-policy.test.ts),
  [@manual](docs/evidence/governance/local-environment-2026-08-16.md)

## Requirement: DIST-03
- Validation: capability-level, SemVer, notes/migration/limits and claim-narrowing rules were
  approved.
- Verification: the canonical support policy and release template contain the required fields;
  this packet is not itself a release decision.
- Result: pass for Phase 0 release policy.
- Evidence: [@manual](docs/support-policy.md), [@manual](docs/release-evidence-template.md)

## Requirement: DIST-04
- Validation: npm trusted publishing, CycloneDX, audit/signature/license and exact-byte binding
  were approved.
- Verification: npm 10 generated CycloneDX and exact tarball digests were inspected; current
  npm verified 220 signatures and 22 attestations, while audit found 8 vulnerabilities.
  Published 0.14.3 provenance was verified for its own tag/commit. Trusted-publisher
  configuration, final-byte binding and future-candidate provenance remain unverified.
- Result: fail for production readiness.
- Evidence: [@manual](docs/evidence/governance/supply-chain-2026-08-16.md),
  [@manual](docs/evidence/governance/provider-status-2026-08-16.md)

## Requirement: DIST-05
- Validation: license, vulnerability, network/CSP, weight, owner and removal rules were
  approved.
- Verification: the lockfile inventory has one missing license entry and `npm audit` reports
  seven high and one moderate finding; complete runtime disposition is absent.
- Result: fail for production readiness.
- Evidence: [@manual](docs/evidence/governance/supply-chain-2026-08-16.md),
  [@test](test/render.test.ts)

## Requirement: DIST-06
- Validation: the current-minor window and one-supported-release notice/active-exploit
  exception were approved.
- Verification: the canonical support and security policies define version support,
  deprecation, end-of-life, migration, reporting and fix boundaries.
- Result: pass for Phase 0 policy.
- Evidence: [@manual](docs/support-policy.md), [@manual](docs/security.md)

## Requirement: DIST-07
- Validation: redistribution authority, attribution and private-reference handling were
  approved.
- Verification: repository MIT license exists, but the lockfile has one missing license entry
  and the complete docs/assets/fonts/reference disposition is absent.
- Result: fail for a release readiness claim.
- Evidence: [@manual](LICENSE),
  [@manual](docs/evidence/governance/supply-chain-2026-08-16.md)
