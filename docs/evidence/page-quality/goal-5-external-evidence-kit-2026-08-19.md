# Goal 5 external-evidence execution kit

Status: **protocol ready; this document is not evidence that any external gate passed**

Candidate commit: `2908d52ef94bb0f8cf74d7f2be021ada78a0d661`

Candidate package: `opencode-artifacts-0.15.0.tgz`

Candidate SHA-256: `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd`

Corpus: `page-quality-v1`; manifest SHA-256
`2badb79c0f21649b8ed6cb72a25fd8ca2b0a9436faf29d7ce8296384cf5a8897`

Use this order. A failure or changed candidate stops later collection until the packet is
amended, reapproved where required, and the affected evidence is rerun.

## 1. Account and retention authorization

Authenticate interactively on the VPS; never paste credentials into chat, git, a command-line
argument, or an evidence file. Keep raw comparison material in the repository-local,
gitignored `.goal5-private/` directory with directory mode `0700` and file mode `0600`; do not
use an unignored `private/` directory. Confirm authorization with these non-secret fields:

```text
authorizedBy: <accountable actor>
claudeAccountScope: <subscription/organization class and allowed Artifact use>
modelProtocol: <same model family and comparable reasoning settings, plus unavoidable differences>
retentionDisposition: <private raw-output location, access, deletion date, and git-safe hashes/aggregates>
```

The coordinator records the visible Claude Code/OpenCode versions, model/settings, capture
date, prompt and fixture hashes, and whether a human edited an output. Three consecutive,
unselected generations are required for each of eight tasks in both systems: 48 total.

After the generation-only private run is complete, create the mapping with a new private seed
of at least 32 random bytes:

```sh
npm run quality:benchmark -- prepare \
  .goal5-private/generation-run.json .goal5-private/blinding-seed \
  .goal5-private/paired-run.json .goal5-private/reviewer-packet.json
```

The command refuses existing outputs. `.goal5-private/paired-run.json` contains the private
system mapping; only `reviewer-packet.json` may go to reviewers. Its 24 A/B pairs contain neutral
`blinded://...` resource names and empty score forms. The coordinator stages the corresponding
desktop, mobile, and interaction resources under those neutral names without exposing source
paths, generation IDs, the seed, or the private mapping.

## 2. Independent corpus review

One reviewer who did not author or maintain this repository inspects every bundle in
`benchmarks/page-quality/v1/` and records:

```text
reviewerId: <pseudonymous code>
independent: true|false
conflicts: <none or exact conflict>
reviewedAt: <ISO timestamp>
corpusId and manifestSha256: <exact values above>
result: pass|fail
findings: <every ambiguity, bias, privacy, provenance, license, or redistribution issue>
```

For each of the eight tasks, the reviewer answers yes/no with a reason:

- Can every required/forbidden fact be decided from the supplied bundle alone?
- Is the prompt neutral between systems and free of preferred-output wording?
- Is the reader decision and every required interaction unambiguous?
- Are all inputs synthetic/project-owned, non-private, hash-bound, and correctly licensed?
- Is redistribution status explicit, with no private or ambiguous third-party material?

Any “no”, unresolved conflict, or omitted task fails this review and blocks corpus verification.

## 3. Blinded page-quality panel

At least three independent, conflict-free reviewers consent to retained scores. The combined
panel includes `design-ux` and domain-appropriate `technical` roles; a third `reader` role is
recommended. Each receives only the neutral reviewer packet and staged A/B resources.

For every pair, every reviewer scores A and B from 1–5 on all eight named dimensions, chooses
`a`, `equivalent`, or `b` overall, and supplies a short reason. No score may be inferred,
rounded, copied between reviewers, or omitted. The coordinator merges scores into the private
paired run, validates it, and retains the complete distribution:

```sh
npm run quality:benchmark -- .goal5-private/paired-run-with-scores.json
```

## 4. Goal 5 manual screen-reader checklist

This is a new candidate-bound run; the earlier Goal 3 attestation cannot be reused. Record the
reviewer, date, exact OS, screen reader/version, browser/version, candidate digest, task IDs,
every failure, and an overall `pass` or `fail`.

Open all eight normalized pages and verify for each:

- the page title, banner, main landmark, section headings, and footer are announced in logical order;
- visual layout does not change DOM reading or focus order;
- primary charts/diagrams/frames have useful names and text equivalents;
- dense, split, full, quiet, and narrow compositions do not hide or repeat content;
- skip-link and keyboard focus are discoverable and visible;
- tables announce caption, headers, and sort state;
- controls announce role, name, current state/value, and changed state;
- status/copy feedback is announced without moving focus unexpectedly; and
- no unlabeled control, empty landmark, confusing repetition, trap, or reading-order defect occurs.

The `findings-table` and `system-explainer` pages must exercise table sorting. The
`interactive-decision` page must exercise radio choice, range change, and copy feedback. The
`pr-walkthrough` page must exercise verdict copy feedback. A failure on any task keeps
`QUAL-04` incomplete.

## 5. Representative-user study

The authorized study owner uses [`goal-5-participant-materials.md`](../../journeys/goal-5-participant-materials.md)
and the strict private-record workflow in [`docs/journeys/README.md`](../../journeys/README.md).
No recruitment begins until the owner, candidate, claimed platform IDs, raw-record location,
access list, withdrawal contact, and deletion date are recorded.

At least ten eligible representative-primary participants are required. Every claimed
install-capable support cell needs one first-time README-only create/reopen pass; these people
may also enter the ten-person comprehension denominator. Raw answers and participant codes
remain access-controlled and uncommitted. Only the aggregate, raw-file digest, failures,
exclusions, withdrawals, owner, and deletion disposition enter git.

## 6. Exact support/browser matrix

Resolve moving labels to exact versions on the test date. Supply the exact candidate to every
target cell in `docs/governance-policy.json`; do not promote the existing Linux/macOS/Windows
CI diagnostics to support.

For a standards-compatible local or remote WebDriver endpoint, run the browser-neutral smoke
at desktop and mobile sizes as applicable. Put endpoint credentials in the process environment,
not the command line:

```sh
WEBDRIVER_ENDPOINT='<private endpoint>' \
WEBDRIVER_CAPABILITIES_FILE='.goal5-private/provider-capabilities.json' \
node scripts/support-browser-smoke.ts \
  --url '<VPS page URL>' --report .goal5-private/result.json --screenshot .goal5-private/result.png \
  --browser firefox --browser-version '<exact version>' --platform '<exact platform>' \
  --width 1440 --height 900
```

The optional capabilities file supplies non-secret vendor device/options needed by a browser
lab. Core browser/platform fields cannot be overridden, credential-looking fields are refused,
and the file is bounded to 64 KiB; authenticate only through the private endpoint environment
value. The command refuses overwrite, redacts endpoint credentials and target queries, records exact
returned browser/platform capabilities, and checks settlement, overflow, clipping, render
errors, keyboard interactions, screenshots, and external resource requests. Standard WebDriver
does not expose a portable accessibility tree or console-log endpoint, so the report explicitly
cannot replace manual accessibility, console, physical-device, or first-use evidence.

## 7. Sign-offs and publication boundary

After all rows pass, record separate accountable `release`, `security`, and `support` sign-offs
with actor and ISO timestamp. Packet approval is not any of those sign-offs.

Tagging and npm publication remain a separately authorized mutation. Only after exact
contemporaneous authority may the release workflow publish these bytes and perform registry
integrity, signature, and provenance readback. Until then the deterministic decision remains
`refused`, all certification/comparison/support claims remain disabled, and provider mutation
count remains zero.
