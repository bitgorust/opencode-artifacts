# Redistribution and attribution inventory

Policy version: 1. Last reviewed: 2026-08-17.

The machine-readable [`redistribution-inventory.json`](redistribution-inventory.json) is the
complete Phase 0 disposition for repository documentation, examples, retained binary assets,
fonts, benchmark references, and dependency evidence. Repository-authored source, policy,
documentation, fixtures, skills, tests, and generated screenshots are distributed under the
root [MIT license](../LICENSE). Every retained binary asset is bound to exact bytes by SHA-256
and names its source and attribution.

No font file is embedded or redistributed. The renderer uses system font-family fallbacks.
Runtime dependency terms and the three exceptional branch choices are governed by
[`license-dispositions.json`](license-dispositions.json) and the exact candidate evidence in
[`renderer-remediation-2026-08-16.md`](evidence/governance/renderer-remediation-2026-08-16.md).

Official Anthropic material and the launch video are link-only benchmark references. The
previous local copy of an official viewer screenshot was removed because no explicit
redistribution license was established. Current same-input Claude outputs remain prohibited
from the repository unless their capture and redistribution authority are recorded first.

The repository check scans retained media, document, video, audio, and font extensions. An
unknown asset, changed digest, missing provenance, local copy of a link-only reference, or
font without a new exact disposition fails closed.
