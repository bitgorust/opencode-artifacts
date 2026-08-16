# Provider prerequisite status — 2026-08-16

Repository: `bitgorust/opencode-artifacts`

| Prerequisite | Observed result | Consequence |
|---|---|---|
| GitHub private vulnerability reporting | Repository API returned `private_vulnerability_reporting.enabled: false` | Failed; `SECURITY.md` cannot direct sensitive reports to a verified private path |
| npm registry provenance for 0.14.3 | Registry metadata and attestation endpoint bind the published package digest to tag `v0.14.3`, commit `58f1976b745ec488cfe6dd301a972a3eeb17e10a`, `.github/workflows/publish.yml`, and GitHub Actions run `31890844916` attempt 1 | Pass for the already-published 0.14.3 bytes only |
| npm trusted-publisher configuration / future provenance | Provider configuration is not publicly verified and no future candidate is published | Unverified; prior provenance and workflow configuration cannot pass a future release |

No provider setting was changed during this observation. Enabling either setting requires an
explicitly authorized external-state checkpoint and follow-up verification.
