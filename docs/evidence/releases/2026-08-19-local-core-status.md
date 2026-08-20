# Local artifact core certification status — 2026-08-19

Decision status: **not eligible; fail-closed record reports refusal**

The first frozen candidate exposed an installed npm-bin entrypoint defect during the new
macOS platform job. The defect was fixed, a new exact candidate was frozen, and every
automated candidate-bound gate was rerun rather than inherited.

Current candidate:

- product commit `2908d52ef94bb0f8cf74d7f2be021ada78a0d661`;
- archive `opencode-artifacts-0.15.0.tgz`;
- SHA-256 `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd`;
- GitHub Actions run `32212321648`: 258 tests, build/check, exact pack, audit,
  licenses, SBOM, dependency signatures/attestations, provenance subject, and stable
  OpenCode host matrix pass; and
- the same tarball passes clean npm-bin render/removal/reopen observations on Linux, macOS,
  and Windows, while constrained CLI/browser performance and 16-cell composition also pass.

Remaining mandatory prerequisites:

- independent ambiguity, neutrality, privacy, and redistribution review of the frozen corpus;
- fresh manual screen-reader review of the Goal 5 composition;
- authorized current Claude same-input generations and three independent reviewers;
- an authorized study owner and at least 10 eligible representative users;
- the complete release-time OS/browser/device matrix, including required Safari, Firefox,
  Windows 11/WSL, previous macOS, and mobile cells;
- separately authorized candidate publication followed by npm integrity, signature, and
  provenance readback; and
- accountable release, security, and support sign-offs.

The exact claim/rollback audit passes, but certification, equal-or-better, and supported-
platform claims remain disabled. No tag, npm publish, deployment, or provider mutation was
performed.
