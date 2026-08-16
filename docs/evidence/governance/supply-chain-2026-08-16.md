# Supply-chain dry-run — 2026-08-16

Scope: working tree candidate `opencode-artifacts@0.14.3`; this is not a published release or
registry provenance result. Results retain failures and therefore do not satisfy D-06.

## Packed bytes

`npm pack --pack-destination /tmp/opencode-governance-pack` produced 43 files:

```text
filename: opencode-artifacts-0.14.3.tgz
size: 49,914 bytes
sha256: 9b25247bed40bf6612326b66394544d9445be3500cb883af00d0dad39b83deb4
sha512 SRI: sha512-Tju71XzWiYRBEsMnk+LXa+49CkfobZVG9DtZyQ2OCYrMW2kCtcLwVPoTFMumjB9TXfr41BDcRaKOLQ8ZXzUhEA==
```

The tarball was generated from an uncommitted policy worktree, so the final commit identity
does not yet exist and this digest is evidence of inspection only.

## CycloneDX

The system npm 9.2.0 has no `sbom` command. An approved temporary npm 10.9.3 invocation ran
`npm sbom --sbom-format cyclonedx` against the exact installed tree and lockfile and produced:

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "tool": "npm 10.9.3",
  "root": "opencode-artifacts@0.14.3",
  "components": 221,
  "dependencyNodes": 222
}
```

The generated document was inspected but is not treated as a release SBOM because it is not
bound to final packed/tagged bytes or retained by release CI.

## Vulnerability audit

`npm audit --json` returned non-zero: 8 findings (7 high, 1 moderate, 0 critical) across 225
dependency entries. Direct affected packages include Vega, Vega-Lite, Vega Embed, and ECharts;
reported remediations require major-version changes. Representative advisories:

- [Vega expression XSS](https://github.com/advisories/GHSA-7f2v-3qq3-vvjf)
- [Vega `setdata` XSS](https://github.com/advisories/GHSA-m9rg-mr6g-75gm)
- [ECharts XSS](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx)

No dependency was changed because dependency additions/upgrades need separate review and the
approved packet requires failures to remain visible. Production readiness fails.

## Registry signatures and provenance

System npm 9.2.0 returned non-zero because `@types/markdown-it@14.1.2` referenced a signing key
whose reported expiry was 2025-01-29. The approved current-tool retry with npm 10.9.3 passed:

```text
220 packages have verified registry signatures
22 packages have verified attestations
```

The current-tool result is the signature verdict; the legacy failure remains recorded as a
tool-version mismatch. npm documents the command's registry-signature and provenance scope in
its [verification guide](https://docs.npmjs.com/viewing-package-provenance/).

`npm view opencode-artifacts@0.14.3 dist --json` and the registry attestation endpoint verified
that the already-published 0.14.3 digest has SLSA provenance from tag `v0.14.3`, commit
`58f1976b745ec488cfe6dd301a972a3eeb17e10a`, `.github/workflows/publish.yml`, and GitHub
Actions run `31890844916` attempt 1. That is a pass for those published bytes only. npm
trusted-publisher configuration and provenance for this unreleased candidate remain
unverified. No registry setting or package was changed.

## License inventory

The lockfile contains 225 dependency package entries. SPDX/value counts were:

```text
MIT 121; ISC 44; BSD-3-Clause 44; Apache-2.0 6; 0BSD 3;
BSD-2-Clause 2; Python-2.0 1; Unlicense 1;
(MPL-2.0 OR Apache-2.0) 1; (AFL-2.1 OR BSD-3-Clause) 1; missing 1
```

`node_modules/khroma` is the missing-license entry. `node_modules/dompurify` requires selecting
MPL-2.0 or Apache-2.0, and `node_modules/json-schema` requires selecting AFL-2.1 or BSD-3-Clause.
Until those dispositions are reviewed and recorded, the license gate fails. The repository
source is MIT; full documentation/example/asset/reference attribution still requires release-
level inspection.

## Release automation status

The tag workflow now runs these four gates before publication, hashes their files, packs once,
publishes that exact tarball, and compares registry integrity/shasum while requiring signature
and provenance metadata. The dependency-free verifier has deterministic pass/failure tests.
Because the current audit and license gates fail, a tag workflow would stop before packaging
or publication. No tag, registry write, or provider-setting change was performed.
