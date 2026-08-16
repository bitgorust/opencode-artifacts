# Security model and response policy

Policy version: 1. Last reviewed: 2026-08-16.

The versioned [threat model](threat-model.md) and public [reporting policy](../SECURITY.md)
govern security claims. Current status is deliberately not production-ready: GitHub private
vulnerability reporting was checked and is disabled, so there is no verified private intake
path for sensitive reports.

## Severity and response targets

Use impact plus exploitability, with CVSS as supporting input rather than an automatic result:

| Severity | Examples | Acknowledge / initial triage target after private intake is operational |
|---|---|---|
| Critical | broad arbitrary code execution, credential theft, authentication bypass, malicious published package | 1 / 2 business days |
| High | scoped code execution, cross-audience private-data disclosure, privilege escalation, reliable supply-chain compromise | 2 / 5 business days |
| Medium | constrained disclosure/integrity loss requiring unusual conditions, meaningful denial of service | 5 / 10 business days |
| Low | limited hardening defect with no demonstrated confidentiality/integrity impact | 10 / 20 business days |

These are targets, not a service-level guarantee. They become operational only when private
intake is enabled and a release names an accountable security owner. Acknowledgment does not
promise a fix. The owner validates affected versions, avoids public exploit details, agrees a
disclosure date with the reporter when possible, and records severity changes.

## Containment and recovery

For a suspected credential or release compromise:

1. pause publishing and affected deployment automation;
2. preserve minimally necessary private evidence and identify the exact affected authority,
   package versions, commits, digests, provider targets, and audience;
3. revoke or rotate only the affected GitHub/npm/provider credentials, OIDC environment or
   trusted-publisher configuration; user-owned Cloudflare/GitHub target credentials remain
   the user's responsibility, with project guidance scoped to the affected integration;
4. deprecate affected package versions and publish bounded upgrade/containment guidance;
5. rebuild from a reviewed commit, repeat tests/SBOM/audit/license/package checks, and verify
   the registry attestation and digest; and
6. resume only after the accountable security and release owners record the recovery result.

Never paste tokens, private advisory content, raw participant data, or private artifacts into
public issues, diagnostics, fixtures, or release evidence. Secret scanning reduces accidental
exposure but is not exhaustive; final audience-bound bytes and staged metadata require review.
