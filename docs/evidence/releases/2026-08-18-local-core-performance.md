# Local-core renderer performance — 2026-08-18

Status: **pass for the exact renderer bytes on the reference Linux container profile**

Environment: Node 24.19.0, Chromium 151, Linux x64, 2 CPU cores, 4 GiB memory. The CLI run used
a constrained `node:24-bookworm` container. The browser run used a constrained
`selenium/standalone-chromium` container, a loopback-only static server, seven fresh browser
profiles per cell, desktop and mobile widths, and reduced motion.

| Workload | CLI p95 | Final bytes | Desktop useful/keyboard p95 | Mobile useful/keyboard p95 |
|---|---:|---:|---:|---:|
| no runtime | 1,066.5 ms | 43,589 | 803.1 / 285.9 ms | 957.6 / 204.5 ms |
| one chart | 876.9 ms | 625,792 | 1,504.9 / 296.2 ms | 1,004.9 / 246.8 ms |
| multiple runtimes | 1,028.5 ms | 5,314,981 | 2,401.6 / 166.4 ms | 1,962.2 / 283.4 ms |

All 36 CLI samples and 42 browser samples are retained in the machine reports. Every workload
passes its time and byte budget; every browser sample reached useful content and keyboard-ready
state with no severe console entry, runtime error, or external request.

- [`CLI distribution`](2026-08-18-local-core-performance-cli.json), SHA-256
  `5322cdf681c49ec4bcbcce5d7adcc7895b31d24c9dfcec7c8adc744d46009fa1`.
- [`Browser distribution`](2026-08-18-local-core-performance-browser.json), SHA-256
  `f52b923391fd653449e97f2947fcbec67f599365d0c62f0e32335057d3d52b20`.

This is one reproducible Linux/Chromium reference profile, not a supported-platform matrix.
