# Support and release policy

Policy version: 1. Last reviewed: 2026-08-18.

This document owns the Phase 0 D-01 platform decision and D-06 release/supply-chain decision.
The machine-readable status record is [`governance-policy.json`](governance-policy.json).

## Current support status

There are currently **no fully supported platform/browser cells**. A dated Ubuntu observation
installed an exact CI tarball, discovered all tools through real OpenCode, rendered and
reopened an offline page in one Chromium build, and repeated the reopen after package-tree
removal. It did not exercise Firefox, the latest two stable browser generations, or a
consented first-time user following only the README. The target matrix therefore remains
unverified and blocks a production-readiness claim.

Public preview is nevertheless distributable after its closed technical, security, privacy,
package-integrity, and supply-chain gates pass. Public preview is explicitly unsupported and
uncertified: it makes no first-use, comprehension, parity, production-readiness, or supported-
platform claim. Narrow observations remain diagnostic. A certified local-artifact-core or
later release still requires the complete target matrix and OUT-02/OUT-03 evidence.

| Cell | Target | Current status | Evidence or missing scope |
|---|---|---|---|
| Ubuntu technical observation | Ubuntu 24.04.4, Node 24.19.0, OpenCode 1.18.18, Chrome for Testing 145.0.7632.6 | Tested, not supported | [Exact packed observation](evidence/governance/ubuntu-packed-observation-2026-08-16.md); Firefox/latest-two/human first-use absent |
| Ubuntu desktop | Ubuntu 24.04 LTS, Node 24, stable OpenCode 1.x, latest two Chromium/Firefox | Unverified | Exact combined run absent |
| macOS desktop | Current and previous macOS, Node 24, stable OpenCode 1.x, latest two Safari/Chromium/Firefox | Unverified | Machines/runs absent |
| Windows desktop | Windows 11 native and WSL 2, Node 24, stable OpenCode 1.x, latest two Chromium/Firefox | Unverified | Machines/runs absent |
| Mobile viewer | Current/previous iOS Safari and current Android Chrome, latest two stable generations | Unverified | Devices/runs absent |
| Node before 24 | Any | Unsupported | Outside D-01 support floor |

“Current” and “latest two” are moving targets, not version evidence. A release owner resolves
them to exact versions on the test date. A cell becomes supported only when one dated record
contains the exact OS, Node, OpenCode, browser/device, packed package digest, test scope, and
result. Failed evidence makes a cell unsupported; missing or stale evidence keeps it
unverified. Family resemblance and CI configuration do not promote a cell.

The initial current and oldest-tested OpenCode versions are both exact `1.18.18`. On
2026-08-18, one deduplicated packed-host cell passed the official CLI configuration mutation,
direct config-array loading, live health/tool-schema discovery, and a non-mutating lifecycle
smoke under clean roots. This is host compatibility evidence, not a supported desktop/browser
claim. The peer SDK dependency is therefore exact `@opencode-ai/plugin@1.18.18`; no broader
1.x or V2 beta range is claimed. A second host version is not claimed until it receives the
same packed-host coverage. Re-run a cell when its OS/browser generation changes, the Node
or OpenCode support line changes, a relevant runtime/renderer dependency changes, or a defect
shows the evidence no longer represents users.

## Package version support

Only the current package minor receives security-fix support. Older minors and all prerelease
or unpublished commits are unsupported; users should upgrade to the newest release in the
current minor. Broader concurrent-minor support requires a separately approved staffed test
matrix.

Deprecation receives notice in at least one supported release, including replacement and
migration guidance. Maintainers may remove or disable behavior immediately when continued
notice would extend an active exploit; release notes must record the security exception
without disclosing usable exploit detail. End-of-life begins when a newer minor becomes the
supported minor. Unsupported versions receive no fix promise.

## Distribution and certification gates

Every distribution uses [the release evidence template](release-evidence-template.md) and
names either `public preview` or one certified capability level. It must include SemVer tag/
version agreement, Conventional Commit history, reviewed notes, migrations, known limits/
failures, and exact evidence for every claim. Missing evidence narrows or fails a certified
claim. For public preview, missing OUT-02, OUT-03, support, parity, and production evidence
must remain explicitly incomplete rather than becoming pass or not applicable.

Public preview uses two transitions. `preview-candidate` passes before registry mutation only
when tests, build, structural checks, package review, final secret/CSP controls, audit,
licenses, redistribution, private intake, and exact trusted-publisher binding pass. `public-
preview` passes only after registry integrity, package signature, and provenance are verified
for those exact bytes. Any failed hard gate blocks or fails the preview. A prior preview
supplies no waiver or evidence to later certification.

The D-06 supply-chain decision follows npm's official
[`npm sbom`](https://docs.npmjs.com/cli/commands/npm-sbom/),
[trusted publishing](https://docs.npmjs.com/trusted-publishers/), and
[provenance verification](https://docs.npmjs.com/viewing-package-provenance/) contracts and
requires all of the following for the exact packed bytes:

- public GitHub Actions OIDC trusted publishing to npm, with registry provenance verified
  after publication;
- CycloneDX JSON generated by npm from the exact lockfile/install;
- `npm audit`, registry signature verification, and an SPDX license disposition;
- package filename, SHA-256, SRI/integrity, tag, commit, workflow run, and registry version
  cross-checked as the same release; and
- attribution for source, dependencies, documentation, examples, embedded assets/fonts, and
  public benchmark references.

The [dated provider report](evidence/governance/provider-status-2026-08-16.md) verifies both
the exact trusted-publisher repository/workflow binding and provenance for the prior published
release. That prior attestation cannot cover future candidate bytes: every release still
needs its own post-publish registry integrity, signature, and provenance verification.
Generated SBOM/provenance describes composition/origin; it does not prove safety.

The tag workflow generates CycloneDX, audit, signature and license outputs before packing,
fails before publication when any gate fails, publishes the exact generated tarball, and then
compares registry integrity/shasum while requiring a signature and provenance.

Dependencies and vendored runtimes must remain lockfile-pinned and receive license,
vulnerability, view-time network, CSP, browser-weight, update-owner, and removal-path review.
Permissive licenses are the default. Reciprocal, source-available, unknown, or conflicting
terms need explicit maintainer/legal review. Removing the package must not break already
created self-contained pages.
