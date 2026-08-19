# Local artifact core candidate: claims and rollback audit

Date: 2026-08-18

Result: **pass**

Candidate SHA-256: `f6d5d5dcdd74ac31522ec9a98acfb38a04c1a4a038c09e65d85d7f4813342bf2`

## Claim audit

The exact candidate archive was inspected, not only the later working tree. Its packaged
README labels the project a public preview, says it is unsupported and uncertified, reports
zero fully supported platform/browser cells, and disclaims representative-user first-use and
comprehension baselines.

The remaining authoritative public surfaces agree:

- `docs/support-policy.md` reports no fully supported platform/browser cells and keeps every
  target desktop/mobile cell unverified.
- `docs/page-quality-benchmark.md` says equal-or-better quality is a target and is not
  verified.
- `docs/roadmap.md` permits no capability-level claim for an unsupported public preview and
  identifies the missing comparative, human, and platform inputs.
- `docs/governance-policy.json` contains no supported target cell.
- the candidate certification record has `certification: false`, `equalOrBetter: false`, an
  empty `supportedPlatformIds` list, decision `pending`, and provider mutation count zero.

No local-artifact-core certification, equal-or-better comparison, production-readiness, or
supported-platform statement is active. The present claim is therefore strictly narrower
than the evidence, not broader.

## Fail-closed and rollback audit

The focused release-model and transition tests passed on 2026-08-18. They verify that missing
requirements or sign-offs refuse certification and return zero provider mutations, that an
unsupported preview cannot claim certification, and that pre-publish/post-publish gates fail
when required evidence is absent.

The current candidate transition was executed and returned `refused`. The absent manual,
comparative, representative-user, support-matrix, registry, and sign-off evidence remained
visible. No tag, registry publish, deployment, or provider mutation was performed.

Rollback for this pre-release candidate is refusal: keep the public-preview disclosures,
leave certification/support/comparison claims disabled, and do not create a release tag or
invoke the tag-triggered publishing workflow. If later evidence contradicts the candidate,
amend and reapprove the affected packets, freeze new exact bytes, and rerun every candidate-
bound gate. If any claim text is accidentally promoted before those gates pass, revert that
claim to the disclosures audited here; no user data or provider state needs restoration
because this candidate has made zero provider mutations.

This row does not approve a release. Final publication still requires the three named
sign-offs plus explicit tag, npm, and provider-mutation authority.
