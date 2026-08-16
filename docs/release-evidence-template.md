# Release evidence: `<tag or candidate>`

Status: Draft / Passed / Failed / Withdrawn

Decision date: YYYY-MM-DD

Release level: local artifact core / local collaboration / public snapshots / authenticated
collaboration / connector-capable artifacts

Release owner: `<one accountable person>`

This template is copied to `docs/evidence/releases/<date>-<tag>.md`. Replace every placeholder;
do not delete a failed or not-applicable row. Attach large machine outputs by path and summarize
them here.

## Claim and scope

- User outcome being released:
- Archived change packets included in this release:
- Included capability classes:
- Explicitly unavailable capabilities:
- Supported Node/OpenCode/OS/browser matrix:
- Supported schema range and migration source versions:
- Support and security-fix window:
- Known limitations:

## Requirements decision

Use one row per requirement or an inclusive range only when every ID has the same result and
evidence. “N/A” requires a reason tied to the selected release level.

| Requirement(s) | Pass / Fail / N/A | Evidence | Accountable role | Notes / exception expiry |
|---|---|---|---|---|
| `<ID>` |  |  |  |  |

Coverage check:

```text
npm run check
```

## Product and UX evidence

- Clean-install time-to-first-artifact (`OUT-02`):
- Comprehension study participants/results (`OUT-03`):
- Create/revise/review/share/export/restore journey evidence:
- Permission, error recovery, Unicode/locale/RTL, teardown evidence:
- Telemetry/measurement consent and default-off verification:

## Automated package evidence

| Command / job | Environment | Result | Output/evidence path |
|---|---|---|---|
| `npm test` |  |  |  |
| `npm run build` |  |  |  |
| `npm run check` |  |  |  |
| `npm pack --dry-run` |  |  |  |
| packed-host oldest supported OpenCode |  |  |  |
| packed-host current stable OpenCode |  |  |  |

Record skipped, flaky, retried, quarantined, and platform-specific failures here:

## Browser, accessibility, and page quality

- Desktop/mobile/color-mode/browser matrix:
- Keyboard and screen-reader results:
- Accessibility scanner and manual findings:
- Console, asset, overflow, and offline-network results:
- Screenshots and interaction traces:
- Current page-quality report, or explicit reason no comparative claim is made:

## Security and privacy

- Threat-model revision and new/changed boundaries:
- Adversarial test results (`QUAL-06`):
- Final-content secret scan:
- Tenant/viewer/cache/origin isolation:
- Dependency, license, and vulnerability disposition:
- Data inventory revision, processors/regions, telemetry status:
- Retention/export/deletion/backup-expiry verification:
- Abuse/takedown and vulnerability-reporting paths:

## Reliability, performance, scale, and cost

- SLO and monitoring evidence for service-backed levels:
- Health, metrics, alerts, and degraded-mode tests:
- Backup/restore result and measured RPO/RTO:
- Rollout/migration/rollback and fault-injection evidence:
- Performance budgets and percentile report:
- Capacity/load/soak/overload report:
- Idle/nominal/limit provider cost model and quota alerts:

## Real-host and provider evidence

| Target | Account/plan class | Smoke scenario | Result | Evidence path |
|---|---|---|---|---|
| OpenCode |  | clean pack install/tool/skill/permission |  |  |
| Claude Code reference |  | official-doc/local-install audit and, if authorized, artifact baseline |  |  |
| GitHub Pages |  | preview/deploy/update/rollback/delete |  |  |
| Cloudflare public |  | preview/deploy/isolation/rollback/delete |  |  |
| Authenticated reference |  | fail-closed origin/two-user/revoke/live/restore |  |  |
| Connector provider |  | grant/isolation/fallback/retry/quota |  |  |

Do not require Claude or provider credentials in CI. Name unavailable external evidence and
reduce the claim rather than converting it to a pass.

## Supply-chain outputs

- Packed filename, SHA-256, SRI, tag/commit/workflow, and registry integrity cross-check:
- CycloneDX JSON from the exact lockfile/install:
- Registry trusted-publisher status and published provenance URL/verification (configuration is not evidence):
- Registry signature verification:
- Dependency vulnerability report and disposition:
- SPDX license/attribution inventory and disposition:
- Release notes and migration guide:

## Decision, rollout, and support

- Open blockers:
- Accepted risks, approver, reason, and expiry:
- Rollout stages and success/abort signals:
- Exact rollback owner and procedure:
- Post-release checks and monitoring window:
- Incident/support contacts:

Final decision: **Pass / Fail / Reduce claim**

Accountable release owner:

Required role reviews for this level:
