# Provider prerequisite status — 2026-08-16

Repository: `bitgorust/opencode-artifacts`

| Prerequisite | Observed result | Consequence |
|---|---|---|
| GitHub private vulnerability reporting | After explicit user authorization, authenticated repository administrator `bitgorust` enabled the setting through the repository API; a separate read returned `private_vulnerability_reporting.enabled: true` | Pass; `SECURITY.md` directs sensitive reports to the verified private advisory path |
| npm registry provenance for 0.14.3 | Registry metadata and attestation endpoint bind the published package digest to tag `v0.14.3`, commit `58f1976b745ec488cfe6dd301a972a3eeb17e10a`, `.github/workflows/publish.yml`, and GitHub Actions run `31890844916` attempt 1 | Pass for the already-published 0.14.3 bytes only |
| npm trusted-publisher configuration | After explicit user authorization and npm owner authentication as `aaron.tsang`, `npm trust list opencode-artifacts --json` returned trusted publisher ID `e60f0a5b-665f-4d39-8300-a29a21bf07a1`, repository `bitgorust/opencode-artifacts`, workflow `publish.yml`, and permission `createPackage` | Pass for the exact `v0.14.4` candidate publisher coordinate; registry provenance still requires the real tag workflow |
| npm registry provenance for 0.14.4 | No 0.14.4 registry bytes exist yet | Pending; the candidate may advance to `preview-candidate`, but not `public-preview`, until registry integrity, signature, and provenance pass |

Both provider settings were changed or confirmed only after explicit authorization on
2026-08-16 and were then read back through their authenticated provider APIs. The npm binding
is exact and passes the pre-publish gate; it does not predict or replace the required
post-publish registry verification.
