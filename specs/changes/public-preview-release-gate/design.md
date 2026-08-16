# Design: Decouple public preview from certification evidence

Required for high-risk changes.

## Context and constraints

Public npm bytes and source copies are irreversible once consumed, while a public repository
does not by itself imply support or production readiness. The current contract conflates
distribution with the first certified capability level, so unavailable human research and
target machines deadlock unrelated engineering and security remediation. The redesign must
not fabricate participants, convert missing evidence to not-applicable, weaken hard security
or supply-chain gates, or let preview history count toward later certification.

## Chosen design

Use an explicit monotonic release-state machine:

1. `development` has no distribution claim.
2. `preview-candidate` requires the closed hard-gate set but may retain incomplete human and
   support evidence.
3. `public-preview` is public, unsupported, uncertified, and bound to exact SemVer/tag/commit/
   bytes/workflow/provenance evidence.
4. `certified-local-core` and later accumulated levels retain the existing participant,
   platform, behavior, and quality gates.

Preview eligibility is represented and tested as data rather than inferred from prose. The
hard-gate set includes build/test/structural/package success, current vulnerability and license
disposition, redistribution inventory, final-byte security controls, verified private report
intake, exact candidate coordinate, trusted OIDC publication, registry byte equality,
signature, and provenance. Missing OUT-02, OUT-03, full support, and comparative evidence is
allowed only in the explicit preview state and must remain `incomplete`/`unverified`.

## Alternatives

- Count Kimi/model sessions as participants: rejected because it does not measure a
  representative developer, violates consent/eligibility rules, and would fabricate the
  denominator.
- Delete OUT-02/OUT-03 entirely: rejected because those remain valuable certification
  outcomes even if the current owner declines to collect them.
- Keep every goal blocked until human/platform inputs appear: rejected by the product owner
  because it prevents public inspection and unrelated engineering progress.
- Claim a narrow supported Ubuntu cell from the existing observation: rejected because the
  run lacks the approved browser generations and human first-use evidence.

## Trust, privacy, and failure boundaries

Preview does not weaken content, credential, dependency, provenance, or reporting controls;
public distribution increases their importance. A release must fail before tagging/publishing
if a hard gate fails. User-facing surfaces must say unsupported and uncertified, name the
tested observation separately from support, and link missing evidence. npm publication is
irreversible for a name/version pair, so exact authorization, SemVer coordination, and
post-publish verification remain mandatory. No participant identity or model credential is
stored in public evidence.

## Migration, rollout, and rollback

Roll out first as contract, validator, and release-evidence changes on the goal branch. Generate
a complete preview candidate record and dry-run the transition before creating a tag. After
explicit release authority and npm trusted-publisher verification, publish one patch preview,
verify registry bytes/provenance, and retain the result. Abort before registry mutation on any
failed hard gate. Rollback disables future preview transitions and uses deprecation plus a
corrective version; published bytes cannot be recalled reliably.

## Formal-method decision

- Decision: bounded state machine plus property-model enumeration.
- Property and rationale: for every combination of preview inputs, publication is allowed if
  and only if every hard gate passes, the preview/unsupported disclosures are present, and
  missing research/platform evidence remains non-pass. Certification additionally requires
  its full evidence and can never inherit a preview waiver. Exhaustive Boolean enumeration is
  tractable and directly protects the dangerous registry transition.
- Model/evidence path: extend `scripts/release-integrity.ts` and
  `test/release-integrity.test.ts`; retain the exact preview record under
  `docs/evidence/releases/`.
