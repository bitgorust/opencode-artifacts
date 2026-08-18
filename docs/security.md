# Security model and response policy

Policy version: 1. Last reviewed: 2026-08-16.

The versioned [threat model](threat-model.md) and public [reporting policy](../SECURITY.md)
govern security claims. GitHub private vulnerability reporting was enabled with explicit
authorization and verified from the provider on 2026-08-16, so sensitive reports have a
private advisory path. That control alone is not a production-readiness claim.

## Severity and response targets

Use impact plus exploitability, with CVSS as supporting input rather than an automatic result:

| Severity | Examples | Acknowledge / initial triage target after an accountable owner accepts the release |
|---|---|---|
| Critical | broad arbitrary code execution, credential theft, authentication bypass, malicious published package | 1 / 2 business days |
| High | scoped code execution, cross-audience private-data disclosure, privilege escalation, reliable supply-chain compromise | 2 / 5 business days |
| Medium | constrained disclosure/integrity loss requiring unusual conditions, meaningful denial of service | 5 / 10 business days |
| Low | limited hardening defect with no demonstrated confidentiality/integrity impact | 10 / 20 business days |

These are targets, not a service-level guarantee. Private intake is operational; the response
targets additionally require a release to name an accountable security owner. Acknowledgment
does not promise a fix. The owner validates affected versions, avoids public exploit details,
agrees a disclosure date with the reporter when possible, and records severity changes.

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

Markdown design configuration is data-only. The renderer reads at most the documented 8 KiB
project token file without following its file or parent-directory symlinks, accepts one
versioned prompt fence, validates fixed names/types and contrast atomically, and emits only
fixed CSS-variable slots. It never accepts selectors, declarations, URLs, markup, imports,
expressions, arbitrary font stacks, or raw CSS; trusted HTML remains a separately disclosed
permission mode.
