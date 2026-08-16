# Security policy

## Reporting status

Private vulnerability reporting is currently **unavailable**. GitHub private vulnerability
reporting was checked on 2026-08-16 and was disabled. Do not place exploit details, secrets,
private artifact content, or personal data in a public issue.
GitHub documents that its private report form exists only after repository owners
[enable private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

Non-sensitive hardening bugs may be reported through the public issue tracker with a minimal
reproduction that contains no confidential data. Until an authorized maintainer enables and
verifies private reporting, this repository does not claim a safe intake path for sensitive
vulnerability reports and does not meet its production-readiness security gate.

## Supported versions

Security-fix support covers only the newest release in the current package minor, as defined
in [`docs/support-policy.md`](docs/support-policy.md). Older minors are unsupported and should
be upgraded. The full severity, response, disclosure, rotation, and compromised-release
process is in [`docs/security.md`](docs/security.md).
