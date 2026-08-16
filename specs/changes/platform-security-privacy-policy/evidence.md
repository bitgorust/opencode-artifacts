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
- Verification: deterministic tests cover authored content, title overrides, frontmatter
  metadata before manifest/gallery writes, all current top-level public files including JSON,
  provider target configuration, and stale files in reused GitHub/Cloudflare staging trees.
  The exact-invocation force override is never persisted.
- Result: pass for current portable and public-deployment surfaces; unshipped authenticated,
  connector, export, and support-bundle boundaries remain planned rather than inferred.
- Evidence: [@test](test/guard.test.ts), [@test](test/plugin.test.ts),
  [@test](test/cli.test.ts), [@test](test/github-pages.test.ts),
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
  deletion authority is claimed. The machine-checked redistribution inventory binds all 21
  retained project-generated assets to exact hashes and MIT provenance, verifies zero embedded
  fonts, keeps external benchmark material link-only, and removed the unlicensed local copy.
- Result: pass for Phase 0 public-sharing policy and current repository disposition; real
  operator handling remains future operational evidence.
- Evidence: [@manual](docs/data-governance.md),
  [@manual](docs/evidence/governance/redistribution-2026-08-16.md),
  [@test](test/governance-policy.test.ts)

## Requirement: COMPAT-01
- Validation: Node 24, the target OS/browser envelope and exact-evidence promotion rule were
  approved.
- Verification: an exact Ubuntu 24.04.4/Node 24.19.0/OpenCode 1.18.18/Chromium technical run
  covers the retained CI tarball, tool discovery, CLI render, offline interaction, and package
  removal. It lacks Firefox, latest-two-browser, and consented first-use coverage. Every target
  cell remains unverified and there are zero supported complete cells.
- Result: fail for the target matrix.
- Evidence: [@test](test/governance-policy.test.ts),
  [@manual](docs/evidence/governance/ubuntu-packed-observation-2026-08-16.md)

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
- Verification: the baseline found 8 vulnerabilities. The approved remediation candidate now
  reports zero audit findings, exact hash-bound license dispositions, 212 verified signatures,
  22 attestations, a CycloneDX SBOM, and candidate provenance bound to packed bytes. Run
  31956792983 retained the exact merge-candidate tarball and evidence. Published 0.14.3
  provenance remains verified only for its own tag/commit, while trusted-publisher
  configuration and a future registry release remain unverified.
- Result: fail for production readiness.
- Evidence: [@manual](docs/evidence/governance/supply-chain-2026-08-16.md),
  [@manual](docs/evidence/governance/renderer-remediation-2026-08-16.md),
  [@manual](docs/evidence/governance/provider-status-2026-08-16.md),
  [@test](test/release-integrity.test.ts)

## Requirement: DIST-05
- Validation: license, vulnerability, network/CSP, weight, owner and removal rules were
  approved.
- Verification: the remediated runtime lockfile reports zero audit findings; exact path and
  content-hash dispositions select the three previously unresolved licenses; compatibility,
  size, and package-tree-removal checks pass.
- Result: pass for runtime dependency governance; production readiness remains blocked by
  other open release gates.
- Evidence: [@manual](docs/evidence/governance/supply-chain-2026-08-16.md),
  [@manual](docs/evidence/governance/renderer-remediation-2026-08-16.md),
  [@test](test/release-integrity.test.ts), [@test](test/render.test.ts)

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
- Verification: repository MIT and runtime dependency dispositions pass. The complete current
  documentation/example/asset/font/reference inventory is machine-checked; every retained
  binary is hash-bound, there are no embedded fonts, external benchmarks are link-only, and
  the ambiguously licensed local official screenshot was removed.
- Result: pass for the current repository distribution inventory.
- Evidence: [@manual](LICENSE),
  [@manual](docs/evidence/governance/redistribution-2026-08-16.md),
  [@test](test/governance-policy.test.ts)
