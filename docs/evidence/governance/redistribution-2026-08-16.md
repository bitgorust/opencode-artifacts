# Redistribution and attribution audit — 2026-08-16

Status: pass for the current repository distribution inventory. This is not legal advice and
does not authorize future third-party captures or private benchmark material.

## Scope and result

The approved Phase 0 governance packet requires compatible licenses and attribution for
documentation, examples, embedded assets, fonts, and benchmark references. The exact
machine-readable disposition is
[`docs/redistribution-inventory.json`](../../redistribution-inventory.json).

- Repository-authored source, policy, documentation, examples, fixtures, skills, tests, and
  generated evidence are covered by the root MIT license.
- All 23 retained binary assets are repository-generated screenshots under `docs/evidence/`.
  Each entry names its synthetic/repository source, MIT disposition, contributor attribution,
  and exact SHA-256.
- The repository contains zero embedded font files. Renderer CSS selects system fallback
  families and copies no font bytes.
- Runtime dependency versions and terms are governed separately by the lockfile, exact
  license dispositions, and retained renderer-remediation evidence.
- The official Anthropic guide and launch demonstration are link-only benchmark references.
  No external benchmark media is retained.

The previous `docs/references/claude-artifact-viewer.png` copy had SHA-256
`5784a8cdc227f204a8b7ebf9a5e6cf4056170db17d2ea96b85f11a1aba82bdf3`. It was removed because
no explicit redistribution license was established. The benchmark and component documents now
link to official material and do not treat a local copy as project-licensed evidence.

## Enforcement

`scripts/governance-policy.ts` scans retained image, document, audio, video, and font
extensions and compares every file to the inventory. It rejects an unknown path, missing
entry, changed digest, missing provenance/attribution, non-MIT retained project asset, local
copy of a link-only benchmark reference, or any embedded font without a new exact disposition.

`test/governance-policy.test.ts` exercises the complete checked-in inventory, a missing asset,
a changed digest, a copied external reference, and an undisposed font. `npm run check` executes
the same repository validation on every push.

## Boundary

External URLs are references rather than redistributed bytes; their availability and terms
remain owned by their operators. Future same-input Claude outputs, participant material,
private artifacts, community examples, or third-party assets require explicit capture and
redistribution authority before they may enter the repository.
