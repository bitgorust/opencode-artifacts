# Provider prerequisite status — 2026-08-16

Repository: `bitgorust/opencode-artifacts`

| Prerequisite | Observed result | Consequence |
|---|---|---|
| GitHub private vulnerability reporting | After explicit user authorization, authenticated repository administrator `bitgorust` enabled the setting through the repository API; a separate read returned `private_vulnerability_reporting.enabled: true` | Pass; `SECURITY.md` directs sensitive reports to the verified private advisory path |
| npm registry provenance for 0.14.3 | Registry metadata and attestation endpoint bind the published package digest to tag `v0.14.3`, commit `58f1976b745ec488cfe6dd301a972a3eeb17e10a`, `.github/workflows/publish.yml`, and GitHub Actions run `31890844916` attempt 1 | Pass for the already-published 0.14.3 bytes only |
| npm trusted-publisher configuration / future provenance | Provider configuration is not publicly verified and no future candidate is published | Unverified; prior provenance and workflow configuration cannot pass a future release |

The GitHub setting was changed only after explicit authorization on 2026-08-16 and was then
read back from the provider. npm trusted-publisher configuration was not changed in this
observation; it still requires an authenticated package-owner session and follow-up publish
verification.
