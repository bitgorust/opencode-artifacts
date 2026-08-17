# Goal 2 lifecycle implementation evidence — 2026-08-16

## Scope and approval

Aaron Zeng (`aaron.zeng`) approved all four high-risk Goal 2 packets at
`2026-08-16T20:32:04Z`. This record covers worktree verification only. No remote push,
provider mutation, real deployment, release, participant result, supported-platform result,
or browser/manual outcome was performed or inferred.

## Passing supported-runtime and focused diagnostics

On 2026-08-17, the canonical commands ran on the Ubuntu 24.04.4 LTS host's ext4 workspace
through the official `node:24-bookworm` image at digest
`sha256:934240a162082fd8b8a2f90cd5114446443f1eba1c5378f6687167ca405e6584`.
The isolated runtime reported Debian 12 x86_64, Node `24.19.0`, and npm `11.17.0`; network
access was disabled for the commands. `npm run build` passed, `npm test` passed all 169 tests,
and `npm run check` passed all 35 registered checks and engineering-principle tags.

The earlier Bun diagnostics below exercised the same TypeScript sources while Node 24 was
being made available. They are supplementary and are not used as support evidence.

Focused Bun diagnostics passed for the same TypeScript sources:

- publication/identity/migration: 38 tests covering independent-process writers, every
  transaction fault point, deletion rollback, manifest validation, legacy repair, backup,
  rollback, schema-2 history, and public-staging exclusions;
- mutable state: 8 tests covering independent-process CAS, replay, bounded conflicts,
  distinct-document merge, quota/rate/override ceilings, future/corrupt/symlink isolation,
  the bounded model, and exact legacy state backup/rollback;
- lifecycle: 4 tests covering exact hostile references, stale merge payloads, rename,
  append-only restore, scoped archive/unarchive, bundle round trip, and the bounded lifecycle
  model;
- plugin: 12 tests, including schema-2 publish preconditions, lifecycle operations, archive
  permission scope, and CAS state tools;
- CLI: 5 tests, including lifecycle aliases, expected-head restore, archive, export/import,
  migration inspection/application/resume, state association, and exact manifest rollback;
- renderer and staging regressions remained green in their focused runs.

A fixed-port loopback smoke returned HTTP 200, state revision 1, and the expected revision/hash
ETag after a schema-2 CAS write. This is a diagnostic only, not browser or supported-Node
evidence.

## Real-browser conflict and limit observation

An isolated Selenium Chromium container at digest
`sha256:1d3d834a2ce93f26cc0d0ae3c61abd189755b32649f5c356c6c5cf9502aa397e`
ran Chrome `151.0.7922.108` on Linux. Chromium and the Node 24 server shared a private network
namespace so the server retained its intentional `127.0.0.1` binding. No external network was
used. Two independent browser tabs loaded the migrated workshop fixture before either client
mutated it.

- The first decision client selected `layout=tabs` at revision 0. The stale second client
  selected `layout=dense`, received the selected revision 1, retained `tabs` on the server,
  set the decision-conflict marker, and displayed the reload/merge notice.
- The first comment client committed one thread at revision 0. The stale second client kept
  the server at revision 1 with one thread, set `reload-required`, and displayed the reload
  notice while retaining the user's unsaved local text.
- An oversized decision value returned HTTP 413 with `quota`; the selected revision and hash
  remained unchanged, and the page displayed the server's bounded reason and next action.

The retained [browser screenshot](goal-2-browser-conflict-2026-08-17.png) has SHA-256
`7dad0994644b24bae412dda64760087d992e00757e1443586e6f8ac7989281b3`. This is automated
real-browser technical evidence for the Goal 2 state workflow, not human usability,
accessibility, mobile, latest-two-browser, or broad platform certification.

## Explicitly unavailable or failed gates

- The host's default shell remains Node `18.19.1`, below the support floor. The exact Node 24
  container run above replaces that earlier runtime gap for repository validation.
- The Ubuntu/ext4 observation does not supply current/previous macOS, Windows 11 native, or
  Windows 11/WSL filesystem results. Schema 2 consequently remains opt-in and non-default on
  every unverified platform.
- The single automated Chromium observation does not supply human desktop/mobile, keyboard,
  screen-reader, Firefox, Safari, or latest-two-browser evidence and creates no broad browser
  support claim.
- `npm pack --dry-run` completed locally for the minor-version candidate: 53 files, 92.2 kB
  packed and 405.1 kB unpacked. This package inspection is not a release, registry result, or
  packed-host compatibility result.
- Exact-candidate CI, packed OpenCode host tests, a draft PR, and the unavailable write-platform
  cells have not been completed for this implementation checkpoint. The earlier Node 18
  command attempted 25 test files and failed at module load; it is retained as an environment
  observation and is superseded for product verification by the green Node 24 run above.

## Gate disposition

The implementation and all four packet verification suites pass, including the canonical
multi-process, every-boundary fault, migration, and real-browser state checks. Phase 1 remains
non-default and Goal 2 cannot close until the unavailable supported write-platform matrix is
resolved. Goals 3–10 must not start while Goal 2 remains at this external evidence gate.
