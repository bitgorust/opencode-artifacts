# Provider prerequisite status — 2026-08-16

Repository: `bitgorust/opencode-artifacts`

| Prerequisite | Observed result | Consequence |
|---|---|---|
| GitHub private vulnerability reporting | After explicit user authorization, authenticated repository administrator `bitgorust` enabled the setting through the repository API; a separate read returned `private_vulnerability_reporting.enabled: true` | Pass; `SECURITY.md` directs sensitive reports to the verified private advisory path |
| npm registry provenance for 0.14.3 | Registry metadata and attestation endpoint bind the published package digest to tag `v0.14.3`, commit `58f1976b745ec488cfe6dd301a972a3eeb17e10a`, `.github/workflows/publish.yml`, and GitHub Actions run `31890844916` attempt 1 | Pass for the already-published 0.14.3 bytes only |
| npm trusted-publisher configuration | After explicit user authorization and npm owner authentication as `aaron.tsang`, `npm trust list opencode-artifacts --json` returned trusted publisher ID `e60f0a5b-665f-4d39-8300-a29a21bf07a1`, repository `bitgorust/opencode-artifacts`, workflow `publish.yml`, and permission `createPackage` | Pass for the exact `v0.14.4` publisher coordinate |
| npm registry integrity, signature, and provenance for 0.14.4 | npm published the 50,698-byte tag artifact through run `31961711046`; retained and independently downloaded tarballs are identical at SHA-256 `7a529bb0cb5cc2460be7df4183315186bf7034dc1284f496448584f2e020de1e`; registry metadata contains a package signature and SLSA provenance binding tag `v0.14.4`, commit `a5ee65a588bc659d232431f55f20f404eb20e6d4`, `publish.yml`, and run attempt 1 | Pass for public preview; the run's final verifier failed only because npm 11 returned a singleton array, retained evidence passes the corrected regression-tested verifier in `b97a9b2` |

Both provider settings were changed or confirmed only after explicit authorization on
2026-08-16 and were then read back through their authenticated provider APIs. The npm binding
is exact and passed the pre-publish gate. The separately retrieved published bytes and
attestation passed every post-publish gate; the workflow parser failure is retained rather
than hidden.
