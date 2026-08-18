# Local artifact core certification status — 2026-08-18

Decision status: **not eligible; fail-closed record reports refusal**

The version-1 certification template and bounded state model are implemented. The model permits
`certified` only for one frozen commit/version/tarball/SHA-256/SRI coordinate when all 13
requirement rows pass with applicable evidence, release/security/support sign-offs are approved,
claims agree with evidence, at least one supported platform is named, and no blocker remains.
Cross-candidate evidence and `not-applicable` waivers for Local artifact core are rejected.

Current unresolved prerequisites are:

- frozen candidate commit `84f866ed742eeb08ba668115342ef0e5896dead7`, package `0.15.0`,
  SHA-256 `f6d5d5dcdd74ac31522ec9a98acfb38a04c1a4a038c09e65d85d7f4813342bf2`;
  the clean stable-OpenCode host matrix passes, while exact-candidate CI is awaiting a rerun
  after its strict npm output and locally verified explicit host-bootstrap fixes;
- no authorized current Claude same-input benchmark or independent reviewer panel;
- no representative-user first-use/comprehension records;
- no complete Ubuntu/macOS/Windows/browser/mobile support matrix for the certified target;
- no exact-candidate audit/license/SBOM/integrity/provenance bundle or accountable sign-offs.

The local 16-cell Chromium composition result and earlier preview evidence remain narrowly
scoped inputs; neither waives these rows. Running
`npm run quality:certification -- docs/evidence/releases/2026-08-18-local-core-candidate.json`
returns the explicit missing rows and sign-offs. No tag, npm publish, deployment, trusted-
publisher change, or other provider mutation was performed or authorized by this record.
