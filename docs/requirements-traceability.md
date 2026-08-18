# Requirements traceability

Status: Normative planning control

Last reviewed: 2026-08-16

This map connects every requirement in [`docs/product-spec.md`](product-spec.md) to delivery,
ownership, and acceptance. Ranges are inclusive: a row such as `OUT-01`–`OUT-06` assigns every
ID in that range to the same cells. An ID may have several implementation phases, but it has
one owning requirement family and one accountable role.

Statuses describe the repository at the review date:

- **Shipped:** the target behavior and required evidence exist.
- **Partial:** useful behavior exists, but at least one normative acceptance condition is open.
- **Missing:** no claimable implementation exists.
- **Blocked:** implementation cannot proceed without the named external decision or authority.

“Evidence contract” names the minimum proof, not an exhaustive test list. Release evidence
must record a requirement as passed, failed, or not applicable with a reason; silence is not
not-applicable.

## Coverage map

| Requirements | Owning perspective | Roadmap / release gate | Accountable role | Evidence contract | Current status |
|---|---|---|---|---|---|
| `OUT-01`–`OUT-06` | Product outcomes | Phase 0 preview contract; Goal 5 and every certification gate | Product maintainer | honest incomplete preview status; named-user journey study, outcome metrics, certification checklist, phase planning fields | Partial |
| `UX-01`–`UX-08` | Human workflow | Phases 0–6; applicable release gate | Product maintainer | end-to-end journey corpus, error/permission/teardown review, Unicode/RTL/zoom QA | Partial |
| `OC-01`–`OC-06` | OpenCode integration | Phase 3; local artifact core | OpenCode integration maintainer | clean packed-host matrix, tool/skill discovery, permission denial tests | Partial |
| `LIFE-01`–`LIFE-07` | Artifact lifecycle | Phase 1; local artifact core | Core storage maintainer | migration fixtures, multi-process race and fault-injection tests, CLI/plugin lifecycle E2E | Partial |
| `RENDER-01`–`RENDER-08` | Portable rendering correctness | Phase 2; local artifact core | Renderer maintainer | schema/security/unit tests, offline browser and asset QA, accessibility evidence | Partial |
| `RENDER-09`–`RENDER-12` | Comparative page quality | Phase 2; local artifact core | Renderer/design maintainer | full same-input benchmark report and hard-gate evidence | Blocked: authenticated Claude baseline and reviewers |
| `LOCAL-01` | Portable/loopback boundary | Phase 2; local artifact core | Local runtime maintainer | strict-CSP offline network test | Shipped |
| `LOCAL-02`–`LOCAL-05` | Local collaboration service | Phase 4; local collaboration | Local runtime maintainer | route fuzzing, two-client concurrency/reconnect, quotas, datasource permission tests | Partial |
| `HOST-01`–`HOST-02`, `HOST-08`, `HOST-10` | Honest public hosting | Phase 5A; public snapshots | Hosting maintainer | staged-tree scan, capability-label, sandbox, dry-run/deploy/rollback tests | Partial |
| `HOST-03`–`HOST-07`, `HOST-09` | Authenticated collaboration | Phase 5B; authenticated collaboration | Hosting maintainer | private-origin proof, two-user ACL/revocation/live-update/CAS/audit E2E | Missing |
| `CONN-01`–`CONN-07` | Viewer-scoped connectors | Phase 6; connector-capable artifacts | Connector maintainer | capability/grant/isolation/fallback/cache/idempotency E2E | Missing |
| `SEC-01`–`SEC-10` | Adversarial protection | Every phase; every release gate | Security maintainer | threat model, abuse cases, isolation/resource tests, response/key-rotation policy | Partial |
| `PRIV-01`–`PRIV-07` | Data purpose and rights | Phase 0 policy; Phases 5–6 implementation; every release gate | Privacy maintainer | data inventory, no-telemetry proof, export/delete test, retention and public-abuse policy | Missing |
| `OPS-01`–`OPS-08` | Reliability and operation | Phases 1, 4, 5B, and 6; applicable release gate | Operations maintainer | SLO dashboard/report, restore drill, degraded-mode/rollout/incident runbooks, quota alerts | Partial |
| `PERF-01`–`PERF-07` | Speed, capacity, and cost | Phases 2, 4, 5B, and 6; applicable release gate | Performance maintainer | reproducible percentile benchmarks, limits, load/soak report, provider cost model | Partial |
| `COMPAT-01`–`COMPAT-08` | Platforms and evolution | Phase 0 preview disclosure; Phases 1 and 3; hosting migration in Phase 5B; every certification gate | Compatibility maintainer | exact tested/unverified preview matrix; support matrix CI/manual QA, schema fixtures, export round trip, upgrade/rollback tests | Partial |
| `DIST-01`–`DIST-07` | Release and supply chain | Phase 0 preview gate, Phase 3 automation, every distribution/certification gate | Release maintainer | preview transition model, packed-host test, clean installs, release checklist, SBOM/provenance/license/vulnerability output | Partial |
| `QUAL-01`–`QUAL-08` | Acceptance evidence | Every phase and release gate | Quality maintainer | traceability check, automated/manual suites, retained evidence, honest failure report | Partial |

## Release applicability

Release levels accumulate: a later level includes the earlier level's requirements. An ID
whose condition does not exist at that level is recorded as not applicable with a reason,
not omitted.

| Release level | Required product behavior | Additional release-specific IDs |
|---|---|---|
| Public preview (non-certified distribution) | Exact package/security/privacy/supply-chain hard gates; unsupported/uncertified label; missing human, platform, parity, and production evidence visible | `OUT-04`, `COMPAT-01`, `DIST-03`–`DIST-07`, `QUAL-01`, `QUAL-02`, `QUAL-06`, `QUAL-08`, and applicable `SEC`/`PRIV`; OUT-02/OUT-03 remain incomplete |
| Local artifact core | `OUT`, `UX`, `OC`, `LIFE`, `RENDER`, `LOCAL-01`, plus applicable `SEC`, `PRIV`, `OPS`, `PERF`, `COMPAT`, `DIST`, `QUAL` | None |
| Local collaboration | Local artifact core + `LOCAL-02`–`LOCAL-05` | Local-service security, privacy, operations, performance, and quality cases |
| Public snapshots | Local collaboration + public hosting | `HOST-01`, `HOST-02`, `HOST-08`, `HOST-10` and applicable portions of `HOST-07` |
| Authenticated collaboration | Public snapshots + authenticated hosting | All `HOST`; hosted `SEC`, `PRIV`, `OPS`, `PERF`, `COMPAT`, `DIST`, `QUAL` cases |
| Connector-capable artifacts | Authenticated collaboration + viewer connectors | All `CONN`; connector-specific cross-cutting cases |

## Acceptance evidence index

Evidence has one canonical home; the matrix links to the class rather than duplicating
results. A release checklist resolves each class to dated files and command output.

| Evidence class | Canonical location |
|---|---|
| Unit/integration tests | `test/` and CI output |
| Structural/release assertions | `scripts/check-repo.ts`, `scripts/checks.ts`, CI, `npm pack --dry-run` |
| Contract link integrity | `scripts/check-links.ts`, `test/documentation-links.test.ts`, dated `docs/evidence/contract/` reports |
| Journey and outcome studies | `docs/journeys/`, `scripts/journey-study.ts`, `test/journey-study.test.ts`, dated `docs/evidence/journeys/` reports |
| Browser and visual evidence | `docs/evidence/` |
| Page-quality comparison | `docs/page-quality-benchmark.md`, dated `docs/evidence/page-quality/` reports |
| OpenCode/Claude host probes | `docs/evidence/opencode-host-verification.md`, `docs/evidence/claude-code-host-verification.md` |
| Threat model and security cases | `docs/threat-model.md`, `docs/security.md`, `SECURITY.md`, security-focused tests |
| Performance/capacity/cost | planned `docs/evidence/performance/` reports and reference-host cost model |
| Privacy/data governance | `docs/data-governance.md`, `docs/governance-policy.json`, dated governance reports |
| Operations | planned runbooks and dated restore/rollout/incident drills |
| Release decision | `docs/release-evidence-template.md`; completed copies under `docs/evidence/releases/` |
| Platform and supply-chain support | `docs/support-policy.md`, `docs/governance-policy.json`, dated `docs/evidence/governance/` reports |

## Change control

Standard and high-risk behavior changes use the packet lifecycle in
[`specs/README.md`](../specs/README.md), governed by
[ADR 0001](adr/0001-spec-anchored-development.md). The target requirement, current shipped
behavior, proposed delta, and acceptance evidence remain separate records.

When adding or changing a normative requirement:

1. place it in exactly one family and explain any cross-family references;
2. update this map, the owning roadmap phase, and its exit gate in the same change;
3. add or identify acceptance evidence and the accountable role;
4. update release applicability when the claim surface changes; and
5. name it in the active change packet, provide normal/failure/boundary scenarios, and run
   proposal validation before implementation;
6. link exact validation and verification evidence, update the affected current spec, and
   archive the verified packet; and
7. run the structural traceability check before commit.

If a concern cannot fit one family without changing that family's definition, the taxonomy
is incomplete and must be revised explicitly rather than hiding the concern in two places.
