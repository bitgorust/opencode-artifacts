# Local-core renderer performance — 2026-08-19

Status: **pass for the refrozen exact renderer bytes on the reference Linux profile**

Candidate SHA-256: `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd`

Environment: Node 24.19.0, Chromium 151.0.7922.108, Linux x64, two CPU cores, and
4 GiB memory. The CLI and browser runners used `node:24-bookworm`; Chromium used
`selenium/standalone-chromium`. Docker constraints were `NanoCpus=2000000000`,
`Memory=4294967296`, and `ShmSize=2147483648`. The browser harness created seven new
WebDriver profiles per cell and declared the same two-core/4-GiB limits because rootless
container cgroup files were not visible inside the runner.

| Workload | CLI p95 | Final bytes | Desktop useful/keyboard p95 | Mobile useful/keyboard p95 |
|---|---:|---:|---:|---:|
| no runtime | 841.0 ms | 43,589 | 887.8 / 392.3 ms | 1,102.2 / 224.7 ms |
| one chart | 839.5 ms | 625,792 | 1,092.3 / 219.2 ms | 1,127.9 / 132.7 ms |
| multiple runtimes | 1,286.5 ms | 5,314,981 | 2,415.1 / 118.6 ms | 1,957.3 / 88.0 ms |

All 36 CLI samples and 42 browser samples passed their time and byte budgets. Every browser
sample reached useful content and keyboard-ready state with no hard failure, severe console
entry, runtime error, or external request.

- [`CLI distribution`](2026-08-19-local-core-performance-cli.json), SHA-256
  `d4a03ac112c78671a31bbf7df8cd7588b655f813019757d79d09242dc0be9322`.
- [`Browser distribution`](2026-08-19-local-core-performance-browser.json), SHA-256
  `b2667091d8d877261e131e63a4e7ef9f3452f4816461080fc859f96dde9918ab`.

This is one constrained Linux/Chromium reference profile, not a supported-platform matrix.
