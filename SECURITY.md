# Security policy

## Reporting status

Private vulnerability reporting is currently **available**. GitHub private vulnerability
reporting was enabled with explicit authorization and independently read back as enabled on
2026-08-16. Report sensitive vulnerabilities through the repository's
[private advisory form](https://github.com/bitgorust/opencode-artifacts/security/advisories/new).
Do not place exploit details, secrets, private artifact content, or personal data in a public
issue.

Non-sensitive hardening bugs may be reported through the public issue tracker with a minimal
reproduction that contains no confidential data. The private path satisfies the intake
portion of the security gate; the broader production-readiness gate still depends on its
other required evidence.

## Supported versions

Security-fix support covers only the newest release in the current package minor, as defined
in [`docs/support-policy.md`](docs/support-policy.md). Older minors are unsupported and should
be upgraded. The full severity, response, disclosure, rotation, and compromised-release
process is in [`docs/security.md`](docs/security.md).
