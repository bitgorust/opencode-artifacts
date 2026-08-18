# Goal 3 renderer performance evidence — 2026-08-17

Scope: comparable reference-profile evidence for `renderer-performance-budgets`. This covers
portable rendering only; hosted collaboration, connectors, load/soak, and provider cost have
their own later requirements.

## Versioned method

Configuration and fixtures live under `benchmarks/renderer/v1/`. The reference profile is
Linux x64, Node 24, Chromium 151, two CPU cores, and 4 GiB memory. Both benchmark containers
were launched with `--cpus 2 --memory 4g`; retained Docker inspection returned NanoCPUs
`2000000000` and memory `4294967296` for the Selenium and local-server containers. The CLI
report independently observed `cpu.max=200000 100000` and `memory.max=4294967296`.

The percentile method is nearest-rank. CLI uses 12 process-level samples per workload and
identifies the first as cold plus the remaining warm distribution. Browser uses seven cold
navigations per workload and viewport, each in a new WebDriver session/profile. A distribution
requires at least five samples. Relative p95 spread must be at most 1.0 and uses a documented
250ms scheduler-noise floor; every raw sample remains in the report. Setup, builds, container
startup, dependency installation, and report serialization are outside timed regions and
listed in each report. Dependencies were preinstalled and install time was not measured or
silently mixed into rendering.

## CLI results

Machine report: `goal-3-performance-cli-2026-08-17.json`. All distributions were stable and
the environment comparison was exact.

| Workload | cold | p50 | p95 | limit | final bytes | runtime bytes | byte state |
|---|---:|---:|---:|---:|---:|---:|---|
| no runtime | 851ms | 739ms | 851ms | 2,000ms | 39,902 | 0 | pass |
| one chart family | 834ms | 786ms | 885ms | 5,000ms | 622,105 | 581,244 | pass |
| multi runtime | 894ms | 868ms | 964ms | 5,000ms | 5,311,264 | 5,269,229 | pass |

The reports separately retain source, runtime, asset, and shell/content contributions, exact
fixture/output hashes, warning/hard thresholds, and remaining capacity. These fixtures contain
no assets, so asset contribution is exactly zero.

## Browser results

Machine report: `goal-3-performance-browser-2026-08-17.json`. Useful content requires the
main surface plus every expected chart/diagram visual. Keyboard readiness requires a focused
decision radio whose ArrowRight transition has completed and updated `aria-checked`.

| Workload | viewport | useful p50 | useful p95 | useful limit | keyboard-additional p95 | limit |
|---|---|---:|---:|---:|---:|---:|
| no runtime | desktop | 724ms | 804ms | 1,500ms | 268ms | 1,000ms |
| no runtime | mobile | 814ms | 896ms | 3,000ms | 203ms | 2,000ms |
| one chart | desktop | 1,207ms | 1,299ms | 3,000ms | 299ms | 1,000ms |
| one chart | mobile | 1,101ms | 1,316ms | 6,000ms | 189ms | 2,000ms |
| multi runtime | desktop | 2,192ms | 2,392ms | 5,000ms | 132ms | 1,000ms |
| multi runtime | mobile | 1,917ms | 2,022ms | 10,000ms | 112ms | 2,000ms |

All six distributions were stable. Every one of the 42 samples retained its timings, local
request inventory, console entries, readiness booleans, and hard-failure list. Across the
matrix there were zero missed readiness marks, runtime errors, severe console entries,
unexpected external requests, or keyboard failures.

## Deterministic gates

`test/performance.test.ts` covers nearest-rank calculation, exact time limits, the next unit,
warning/hard byte boundaries, missing/invalid/noisy distributions, the scheduler floor,
environment mismatches, injected runtime/request failures, fixture hard-byte validation, and
exact report/config/fixture hash binding. The existing absolute 15 MiB renderer and publisher
tests retain no-write behavior above the product cap.
