# Design: Certify the local artifact core release

## Context and constraints

Certification is a security- and compatibility-sensitive decision over one immutable package,
not a summary of repository progress. The candidate accumulates Phases 0-3 and every applicable
OUT/UX/OC/LIFE/RENDER/LOCAL-01/SEC/PRIV/OPS/PERF/COMPAT/DIST/QUAL obligation. Evidence can be
local, human, platform, or provider-derived, but must name scope, date, owner, exact candidate
applicability, and outcome. Existing preview evidence is reusable only when it truly applies to
the same inputs; it never waives a certified gate.

## Chosen design

Add a versioned machine-readable certification record plus a human release report. Freeze the
source commit, version, tarball bytes, SHA-256, SRI, and corpus versions before collecting
candidate evidence. Model each requirement row as `pending`, `pass`, `fail`, or `not-applicable`;
the latter requires a reason allowed for the local-core level. Evidence records carry type,
path, date, owner, candidate digest or explicit non-byte-bound scope, environment, and result.
The only transition to `certified` requires all applicable rows pass, external prerequisites
resolve, accountable sign-offs exist, claims agree, and no unresolved blocker remains.

Candidate verification and release mutation are separate. This packet permits building and
testing candidate bytes. It does not permit creating a release/tag, publishing to npm, changing
trusted-publisher settings, or deploying; each external mutation needs exact contemporaneous
authority and any required post-provider evidence.

## Alternatives

- A prose-only checklist was rejected because omitted and mismatched evidence is hard to detect.
- Reusing the public-preview decision was rejected because certification has broader accumulated
  gates and provider attestation is byte-specific.
- Certifying only the currently available Linux/Chromium cell was rejected because it would
  contradict the normative COMPAT-01 target rather than transparently re-scope it.
- Treating absent humans/reference runs as not-applicable was rejected because OUT-02, OUT-03,
  RENDER-12, QUAL-07, and QUAL-08 explicitly make them mandatory for this claim.

## Trust, privacy, and failure boundaries

The release record contains no secrets, participant identities, private artifact contents, or
provider credentials. Human raw data remains access-controlled under the approved retention and
withdrawal protocol; the repository receives aggregates and digests only. Claude captures obey
account authorization and redistribution constraints. Any failed, missing, stale, ambiguous, or
cross-candidate evidence yields a refusal. No release action occurs as a side effect of evidence
validation. Logs and reports are bounded and redact secret-like values.

## Migration, rollout, and rollback

Migration fixtures cover every released local schema and must pass upgrade, backup, idempotence,
fault, and rollback checks on the frozen candidate. Certification produces a decision artifact,
not a deployment. If later publication is authorized, rollout uses the existing trusted-
publishing workflow and requires exact registry integrity/signature/provenance readback; failure
halts or deprecates the candidate according to the security policy. Before publication, rollback
is simply refusal and rebuilding a new candidate. After publication, the documented compromised-
release and SemVer policies apply; evidence from changed bytes cannot be patched in place.

## Formal-method decision

- Decision: bounded state-machine model plus property-based transition tests.
- Property and rationale: `certified` is unreachable unless one immutable candidate has every
  applicable row passing, every required sign-off present, no blockers, and consistent claims;
  validation and refusal never perform provider mutation. This targets the dangerous class of
  partial, stale, or cross-byte evidence accidentally producing a release claim.
- Model/evidence path: planned `test/model/local-core-release-model.ts` and transition tests,
  with a dated exact-candidate report under `docs/evidence/releases/`.
