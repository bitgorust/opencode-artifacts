# Dependency remediation proposal — 2026-08-16

Status: approved by `bitgorust` at 2026-08-16T14:57:27Z; no dependency change has yet been
applied. The approval selects the three proposed exact license branches and hash bindings.

## Vulnerability baseline

`npm audit --json` reported eight findings on the current lockfile: seven high and one
moderate. The direct renderer versions and current registry fix targets observed on
2026-08-16 are:

| Package | Current | Proposed fix line |
| --- | ---: | ---: |
| `echarts` | 5.6.0 | 6.1.0 |
| `vega` | 5.33.1 | 6.4.0 |
| `vega-lite` | 5.23.0 | 6.4.3 |
| `vega-embed` | 6.29.0 | 7.1.0 |

The relevant advisory classes include raw ECharts series names reaching tooltip HTML,
Vega debug/global gadget execution, and Vega expression `setdata` execution. These are in
scope because artifact chart specifications are untrusted user input:

- <https://github.com/advisories/GHSA-fgmj-fm8m-jvvx>
- <https://github.com/advisories/GHSA-7f2v-3qq3-vvjf>
- <https://github.com/advisories/GHSA-m9rg-mr6g-75gm>

## License baseline

The release license gate currently fails closed for one missing-metadata package and two
compound-license packages. Inspection of the exact installed files produced these candidate
dispositions. The maintainer approved these exact selections at the timestamp above.

| Package and dependency path | Installed license evidence | Proposed branch |
| --- | --- | --- |
| `mermaid@11.16.1 > khroma@2.1.0` | `node_modules/khroma/license`, SHA-256 `66b333b0f66759a0b710459e03f7029abe17f4358114a128d2c972e642961b49` | MIT — approved |
| `mermaid@11.16.1 > dompurify@3.4.13` | `node_modules/dompurify/LICENSE`, SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` | Apache-2.0 — approved |
| `@opencode-ai/plugin@1.18.18 > @ai-sdk/provider@3.0.8 > json-schema@0.4.0` | `node_modules/json-schema/LICENSE`, SHA-256 `4e053c510d6f3e4724213a292c65142df68d069c40f558582bc4270914e16f77` | BSD-3-Clause — approved |

Alternative installed branches are DOMPurify MPL-2.0 (SHA-256
`fab3dd6bdab226f1c08630b1dd917e11fcb4ec5e1e020e2c16f83a0a13863e85`) and json-schema
AFL-2.1 in the same compound file. The proposal prefers the permissive branches but does not
convert that preference into a broader approval for future versions, hashes, or branches.

## Required acceptance evidence

- Fresh audit and license reports for the exact post-upgrade lockfile and packed candidate.
- Recorded human approval for the three exact license branches and hashes.
- Compatibility and adversarial-payload tests across the real renderer surface.
- CSP, offline-network, package-removal, browser-smoke, accessibility, and size-delta results.
- SBOM, signature, provenance, and package-integrity evidence for the same candidate bytes.

Until all of those checks pass, the release gate remains intentionally blocked.
