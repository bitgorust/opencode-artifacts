# Local artifact core candidate: claims and rollback audit — 2026-08-19

Result: **pass**

Candidate SHA-256: `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd`

The exact archive's packaged README labels the project a public preview, says it is
unsupported and uncertified, reports zero fully supported platform/browser cells, and
disclaims representative-user first-use and comprehension baselines. The support policy,
page-quality benchmark, roadmap, governance record, and new certification record agree:
certification and equal-or-better claims are false, and no supported platform ID is named.

Focused release-transition coverage plus the complete 258-test CI suite verify fail-closed
behavior. The current certification command returns `refused` while mandatory rows, blockers,
and sign-offs are missing. No tag, npm publish, deployment, or provider mutation occurred.

Rollback for this pre-release candidate is refusal: keep the public-preview disclosures,
leave certification/support/comparison claims disabled, and do not trigger the tag workflow.
The earlier frozen candidate remains historical evidence; the installed-bin defect caused a
new exact candidate to be frozen rather than relabeling old evidence. Any future contradicting
evidence requires the same amend, refreeze, and candidate-bound rerun.

This audit does not approve release. Publication still requires explicit authority and final
release, security, and support sign-offs.
