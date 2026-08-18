# Local-core exact-candidate CI evidence — 2026-08-18

Status: **pass for automated code, package, audit, license, SBOM, signature, and stable-host gates**

- GitHub Actions run: `32161443356`, attempt 1, job `95791053464`.
- Workflow result: green after install, build, 255 tests, structural checks, candidate evidence,
  and artifact upload.
- Frozen package: `opencode-artifacts-0.15.0.tgz`.
- Candidate SHA-256: `f6d5d5dcdd74ac31522ec9a98acfb38a04c1a4a038c09e65d85d7f4813342bf2`.
- npm integrity: `sha512-ErzQBzSxNz/nuxsTfwi5uozrJvK5joo7c6SyHeWz9THM49ETSY5PajdrxdfXq0J86lGAK4HdahCKyEo1gPIjKA==`.
- Pull-request merge coordinate used by the workflow:
  `a3d3b2f04d4c195b6ad082fc8f3225d5111023c5`; its packed subject exactly matches the
  frozen source candidate's reproducible tarball digest.
- Audit: 0 vulnerabilities at info, low, moderate, high, and critical across 217 dependency
  entries.
- Licenses: 217 entries inventoried; the one missing declaration and two compound choices match
  their exact checked-in file/version/hash dispositions.
- Registry dependency verification: 212 packages with verified signatures and 22 with verified
  attestations.
- CycloneDX SBOM: 211 components, serial
  `urn:uuid:0191ab18-e6ee-452f-9a0e-cc93f0bf917d`.
- Packed stable-host matrix: pass for OpenCode `1.18.18`; broader ranges remain unproven.

The uploaded `exact-candidate-evidence` artifact was downloaded and independently rehashed.
Its retained file hashes are:

| File | SHA-256 |
|---|---|
| `audit.json` | `1a6880655b7fe998c3f6cb838d1afedac09b478a552e3f1f38bff5a0416b74b8` |
| `licenses.json` | `4bc307c41b17ccdc6e6590f6f940939033b86cf3444617abeb2b0f356e101cea` |
| `opencode-host-matrix.json` | `acdcd69fe954fb175ae84950b014b6e46b41cf04268c6a19f47015f470430bf6` |
| `pack.json` | `bfc85967fa2d160c77a8b72de15743949111935a5826eed54030872e3875b705` |
| `provenance.intoto.json` | `bbc308c9a263f7b089db75f74e69d15bbac8d60245edfb17dc888d947cb859f8` |
| `sbom.cdx.json` | `c943f29ec4d1b73cd70ab4b2525603ba58e093d8c413a6cd9e3ea7e1e28cf8a5` |
| `signatures.txt` | `96dbc2926fd8b9c4d367ef9d0b827d3c6ad9301a3aba7b872601edb3d234df12` |
| `opencode-artifacts-0.15.0.tgz` | `f6d5d5dcdd74ac31522ec9a98acfb38a04c1a4a038c09e65d85d7f4813342bf2` |

This evidence does not supply manual accessibility, broad platform support, current Claude
comparison, representative-user outcomes, accountable sign-offs, or registry publication
readback for this candidate.
