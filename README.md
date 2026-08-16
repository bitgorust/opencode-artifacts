# opencode-artifacts

Publish OpenCode session output as self-contained, interactive HTML artifact pages.

> **Status: public preview.** The project is publicly inspectable but currently unsupported
> and uncertified. There are zero fully supported platform/browser cells, and no representative-
> user first-use or comprehension baseline is claimed. Exact technical and supply-chain
> evidence is linked below.

[![npm](https://img.shields.io/npm/v/opencode-artifacts)](https://www.npmjs.com/package/opencode-artifacts)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![A funnel-analysis artifact in the report theme: emphasized stat cards, an annotated area chart marking the v4.2 drop, an insight callout, and a before/after comparison](docs/evidence/patterns/funnel-report.png)

One Markdown source, four curated looks — the same page in `ops` and `editorial`:

<table><tr>
<td><img src="docs/evidence/patterns/funnel-ops.png" alt="The same artifact in the ops theme: dark-first, terminal green"></td>
<td><img src="docs/evidence/patterns/funnel-editorial.png" alt="The same artifact in the editorial theme: white, serif display type"></td>
</tr></table>

More verified pages — dashboard, incident, PR walkthrough, checklist, compare, workshop,
tuning playground — in [`docs/evidence/patterns/`](docs/evidence/patterns/), each rendered
from [`examples/patterns/`](examples/patterns/) and browser-tested with zero console errors.

Inspired by [Claude Code Artifacts](https://code.claude.com/docs/en/artifacts), rebuilt as a
local-first, open-source [OpenCode](https://opencode.ai) plugin. The model writes Markdown + JSON specs; a fixed
renderer owns the HTML/CSS, so page quality doesn't depend on the model's design skills and
output stays diff-friendly and cheap in tokens.

## Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [Authoring format](#authoring-format)
- [Sharing and hosting](#sharing-and-hosting)
- [Limitations](#limitations)
- [Governance and support](#governance-and-support)
- [Development](#development)
- [Product specification](#product-specification)
- [Roadmap](#roadmap)
- [Parity with Claude Code Artifacts](#parity-with-claude-code-artifacts)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Dashboards, PR walkthroughs, incident timelines, checklists, comparisons** — component fences (`stats`, `timeline`, `findings`, `compare`, `callout`, `progress`, `diff`, `copy`, `mermaid`, `decisions`, `table`) plus Vega-Lite / Vega / ECharts / Mermaid charts, all inlined into one strict-CSP file
- **Interactive data tables**: the `table` fence gives you sortable, filterable, number-formatted tables with row counts — [license-audit example](docs/evidence/patterns/license-audit.png)
- **Provenance on every page**: frontmatter `source:` lands in the footer as `Data: …`
- **Curated themes**: frontmatter `theme: report | ops | editorial` restyles the whole page — [one source, three identities](docs/evidence/patterns/funnel-report.png); unnamed pages follow system dark/light with a three-state header toggle
- **Gallery + versions**: every publish updates `.opencode/artifacts/index.html`; `version: true` keeps numbered history; `restore` rolls back; a stale-version hash guard prevents blind overwrites
- **Interactive**: chart-bound controls (vega-lite `params.bind`, echarts `dataZoom`), text-selection comments, workshop decision pages the session can read back
- **Live reload**: `opencode-artifacts serve` refreshes open pages on every republish
- **Sharing**: cost-free public snapshots via GitHub Pages or a user-operated Cloudflare Worker + KV; Cloudflare Access is a manual, unverified perimeter
- **Safe by default**: no raw HTML passthrough, credential-pattern scan blocks accidental secret leaks, no external requests at view time

## Install

```bash
opencode plugin opencode-artifacts
```

Published at [npmjs.com/package/opencode-artifacts](https://www.npmjs.com/package/opencode-artifacts).
The [dated provider report](docs/evidence/governance/provider-status-2026-08-16.md) verifies
provenance for the then-current registry release. The registry trusted-publisher setting and
provenance for unreleased candidate bytes remain unverified until post-publish checks; see the
[support and release policy](docs/support-policy.md).

The official OpenCode plugin command installs the package and updates the project config.
Alternatively, add the npm package directly to `opencode.json`; OpenCode installs npm plugin
dependencies automatically at startup:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-artifacts"]
}
```

The `file:` spec is only for developing this plugin itself (point OpenCode at your checkout
after `npm install && npm run build`):

```json
{
  "plugin": ["file:///absolute/path/to/opencode-artifacts"]
}
```

Optional, for hosted deploys — the wizard asks once whether and where to deploy and writes the
answer to `.opencode/artifacts.json` (`--global` for all projects):

```bash
npx opencode-artifacts init
# non-interactive: npx opencode-artifacts init --yes --target github --repo you/artifacts
```

## Usage

In a session, just ask:

> Summarize this incident investigation and publish it as an artifact with a timeline and an error-rate chart.

The agent calls the `artifact_publish` tool with Markdown like:

````markdown
---
title: Incident 4172 — Checkout latency spike
icon: 🚨
description: p99 spike traced to a sync fraud-check call
---

```stats
[{ "label": "PEAK P99", "value": "2.6s", "tone": "bad", "emphasis": true }]
```

```vega-lite
{ "data": { "values": [...] }, "mark": "bar", "encoding": { ... } }
```
````

and gets back `Artifact published to <worktree>/.opencode/artifacts/incident-4172-checkout-latency-spike.html`.

For proactive behavior (the agent publishes on its own when output suits a page), enable the
plugin option:

```json
{
  "plugin": [["opencode-artifacts", { "proactive": true }]]
}
```

This injects the bundled guidance (adapted from Claude Code's artifact-design skill) into the
session's system context — visible in the plugin source, off by default, and removable by
deleting the option. Alternative for non-plugin environments: `cp -r skills/artifact-pages
~/.agents/skills/` (don't use both).

Comment triage at scale: `agents/artifact-comment-analyst.md` is a read-only subagent that
digests open comment threads into an actionable brief (blocking issues first, with the page's
current wording at each quote). Install with
`cp agents/artifact-comment-analyst.md ~/.config/opencode/agent/`.

CLI (also usable standalone, `npm install -g opencode-artifacts`):

```bash
opencode-artifacts render page.md --open --version   # render + open + keep version history
opencode-artifacts serve                             # http://127.0.0.1:4173, live reload
opencode-artifacts restore <slug> --version 1        # roll the stable page back
opencode-artifacts latest --open                     # reopen the most recent artifact
opencode-artifacts state <slug>                      # read workshop answers back
```

## Authoring format

Full reference: [`docs/component-spec.md`](docs/component-spec.md). Short version:

- **Frontmatter**: `title`, `icon` (emoji favicon), `description` (gallery subtitle)
- **Components** (JSON fences): `stats` metric cards, `timeline`, `findings` (severity-coded), `compare` variant cards, `callout` insight cards, `progress`, `diff` (annotated), `copy` (copy-to-session button), `decisions` (workshop rows the session reads back via `artifact_state`)
- **Charts/diagrams**: ```` ```vega-lite ```` / ```` ```vega ```` / ```` ```echarts ```` / ```` ```mermaid ```` fences; runtimes inline only when used
- **Markdown extras**: GitHub alerts (`> [!WARNING]` etc.), task lists, heading anchors, `##` sections become cards
- Broken specs degrade to inline error boxes; the page always ships

Worked examples for every canonical pattern: [`examples/patterns/`](examples/patterns/) with
browser-verified screenshots in [`docs/evidence/patterns/`](docs/evidence/patterns/).

## Sharing and hosting

| Target | Command | You get |
|---|---|---|
| Local files | (default) | `.opencode/artifacts/<slug>.html` + gallery |
| Live preview | `opencode-artifacts serve` | localhost gallery, SSE live reload, comments/decisions/mini-DB persistence |
| GitHub Pages | `opencode-artifacts deploy --repo you/artifacts` | public URL per artifact; git history as audit log ([live demo](https://bitgorust.github.io/artifacts/)) |
| Cloudflare | `deploy --target cloudflare --name my-artifacts` | User-operated public-by-default Worker + KV; comments/decisions/DB work hosted; Access is a manual perimeter — [guide](docs/hosted-cloudflare.md) |

## Limitations

- Local-first: without a deploy target, artifacts are files on your machine — no share links
- Viewer-identity MCP data calls (Claude Code's connector model) need hosted infrastructure we don't run; the datasource bridge executes local shell commands only, and only under `serve`
- Raw per-page JavaScript (drag-drop boards etc.) is only possible in `format: "html"` mode, which opts out of the fixed renderer's guarantees
- GitHub Pages and an unprotected Workers URL are public snapshots, not Claude-style private
  sharing. Cloudflare Access is currently a manual deployment prerequisite rather than a
  verified access policy managed by this package.
- Hosted pages do not yet push new revisions into already-open browsers, and hosted MCP calls
  do not run through each viewer's identity.
- No complete Node/OpenCode/OS/browser cell currently meets the supported-platform evidence
  gate. Existing Linux host and CI observations have narrower scopes.

## Governance and support

Current public-preview policy is explicit about incomplete certification evidence:

- [support and release policy](docs/support-policy.md) — Node 24 floor, zero currently
  supported full matrix cells, current-minor fix window, deprecation and D-06 supply chain;
- [security model and response](docs/security.md) and [public reporting status](SECURITY.md) —
  threat boundaries and response process; private vulnerability reporting is enabled and
  verified;
- [data governance](docs/data-governance.md) — no default local telemetry, mode-specific
  inventory, operator/controller boundaries, retention/deletion and public abuse handling.

These documents do not turn missing provider, platform, participant, or production evidence
into a readiness claim.

## Development

```bash
npm install
npm test        # node --test, no framework
npm run build   # tsc -> dist/
npm run check   # structural contracts
```

Behavior changes use the repository-native
[spec-anchored workflow](specs/README.md): risk-scaled proposal/delta packets, human approval,
exact validation and verification evidence, and an updated current-behavior spec before
archive. The governing decision and alternatives are in
[ADR 0001](docs/adr/0001-spec-anchored-development.md).

## Product specification

The authoritative target, boundaries, security model, and definition of complete are in
[`docs/product-spec.md`](docs/product-spec.md). It is grounded in current official Claude Code
Artifacts and OpenCode documentation and distinguishes portable pages, public snapshots,
authenticated collaboration, and viewer-scoped connectors.
Its MECE requirement families map to delivery phases, owner roles, evidence, release
applicability, and current status in
[`docs/requirements-traceability.md`](docs/requirements-traceability.md).
“Equal or better” page quality is a target, not a current claim; the reproducible same-input
comparison and pass thresholds are defined in
[`docs/page-quality-benchmark.md`](docs/page-quality-benchmark.md).

## Roadmap

The gap-driven phased plan is [`docs/roadmap.md`](docs/roadmap.md). Immediate priorities are
durable artifact identity and unconditional immutable revisions, cross-process/crash-safe
publishing, embedded local assets, and packed-package compatibility tests against OpenCode.
Authenticated sharing and viewer-scoped connectors are later phases with explicit identity,
consistency, permission, and audit gates.
For long-running execution, [`docs/goal-runbook.md`](docs/goal-runbook.md) provides the full
ordered `/goal` sequence, copy-ready objectives, human/external prerequisites, packet
decomposition, stopping conditions, and handoff to the next release level.

## Parity with Claude Code Artifacts

The official-doc baseline, implementation comparison, and verified QA log are in
[`docs/claude-code-comparison.md`](docs/claude-code-comparison.md). Reverse-engineered
inventory is supplemental research, not the source of parity claims.
[Clean OpenCode host evidence](docs/evidence/opencode-host-verification.md) covers the current
CLI and previously published 0.14.3 package; the
[Claude Code host evidence](docs/evidence/claude-code-host-verification.md) covers a healthy
local 2.1.233 install and its unauthenticated service boundary.

## Contributing

Issues and PRs welcome at
[github.com/bitgorust/opencode-artifacts](https://github.com/bitgorust/opencode-artifacts/issues).
Please run `npm test` before submitting; add a test for every behavior change. For anything
visual, attach a browser screenshot. Standard and high-risk behavior changes also follow the
[spec-anchored change workflow](specs/README.md).

## License

[MIT](LICENSE) © bitgorust. Documentation, examples, retained screenshots, dependency
dispositions, and link-only benchmark references are covered by the
[redistribution inventory](docs/redistribution-policy.md).
