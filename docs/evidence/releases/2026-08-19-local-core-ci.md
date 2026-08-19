# Local artifact core exact-candidate CI — 2026-08-19

Status: **pass for automated candidate gates; publication gates remain pending**

GitHub Actions run: `32212321648`, attempt 1

Workflow head: `a9b1b13e97f4f187e9b1d931bf7ef54fb9bd54fc`

Frozen product candidate commit: `2908d52ef94bb0f8cf74d7f2be021ada78a0d661`

PR merge commit recorded by CI provenance: `5b952e1540ae999fd300aff9e2e9f33c72c2e96f`

## Exact package

| Field | Value |
|---|---|
| Archive | `opencode-artifacts-0.15.0.tgz` |
| SHA-256 | `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd` |
| npm shasum | `9dbcd2f6d05e5984c698c97ec9524f0f21a237ef` |
| SRI | `sha512-X9IgvKCHvs1Q5QegNWoBcdId/tIkqlrF0dNSlfSPCCj2Lehrfbl+j4HF2QSVHUNtGFRpGMw6OhDYHLKKARDXfQ==` |
| Packed / unpacked | 126504 / 543313 bytes |
| Entries | 69 |

The `verify` job passed install, build, 258 tests, structural assertions, pack-coordinate
validation, candidate provenance, audit, license disposition, SBOM generation, registry
dependency-signature verification, and the clean stable-OpenCode host matrix.

- vulnerabilities: 0 among 217 dependency entries;
- dependency registry signatures: 212 verified;
- dependency attestations: 22 verified;
- CycloneDX components: 211; and
- packed OpenCode host: exact stable `1.18.18`, with real health, tool/skill discovery,
  permission policy, config loading, read-only lifecycle smoke, and package-tree-independent
  installed skill checks passing.

Artifact `exact-candidate-evidence` has ID `9351205020`, archive digest
`sha256:71ee5d2e49474285ee5c28240d090786f6b8b43af25afff67d53b8c1aedf74db`, and expires
2026-09-02. Its in-toto subject is the exact SHA-256 above and its invocation is run
`32212321648`, attempt 1.

## One tarball across three operating systems

The platform jobs depend on `verify`, download its retained tarball, and never repack it.
Each installed the same SHA-256 with lifecycle scripts disabled, invoked the installed npm
bin, rendered a portable page with strict `connect-src 'none'`, removed the entire package
tree, and read back byte-identical HTML.

| Observation | Exact environment | Artifact ID | Result |
|---|---|---:|---|
| Linux | Ubuntu 24 image `20260810.271.1`; Linux `6.17.0-1022-azure`; x64; Node `24.19.0` | `9351218207` | pass |
| macOS | macOS `25.5.0`; image `macos26` `20260728.0273.1`; arm64; Node `24.18.0` | `9351220424` | pass |
| Windows | Windows Server 2025 `10.0.26100`; image `win25-vs2026` `20260810.198.2`; x64; Node `24.19.0` | `9351282347` | pass |

These are technical observations, not supported cells. They do not cover Windows 11/WSL,
previous macOS, browsers, physical mobile devices, assistive technology, or representative
first-use. The matrix deliberately records all of those exclusions.

## Boundary

CI provenance describes the unissued candidate; it is not npm registry provenance. No tag,
publication, registry signature, registry byte readback, deployment, or provider mutation
occurred. Those gates cannot pass until separately authorized publication and verification.
