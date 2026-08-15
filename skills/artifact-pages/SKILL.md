---
name: artifact-pages
description: Publish session output as interactive artifact pages via the artifact_publish tool (opencode-artifacts plugin). Use proactively whenever a deliverable has an audience — reports, plans, PR walkthroughs, dashboards, incident timelines, comparisons, checklists — or whenever output is easier to see as a page than to read as terminal text. Covers when to publish, page naming, and the comment loop; component schemas live in reference/components.md.
---

# Artifact Pages

You have the `artifact_publish` tool (opencode-artifacts plugin). It renders Markdown + JSON
component specs into one self-contained interactive HTML page under `.opencode/artifacts/`.
The renderer owns all design — your job is structure and content, never CSS.

Authoring reference (component JSON schemas, chart fences, alerts, task lists):
**reference/components.md** in this skill's directory. Load it before building your first
page in a session, or whenever you need an exact schema.

## When to publish

A finished deliverable with an audience — a report for a team, a plan other people will
follow, a document meant as a reference — is not fully delivered while it lives only in
terminal scrollback or a local file. Finishing such work includes publishing it as an
artifact and handing the user the path, so they have a page ready to share when they choose.
(Adapted from Claude Code's Artifact tool description.)

Publish proactively when output is easier to look at than to read line by line:

- PR / change walkthrough → `findings` + `diff` components
- Dashboard or status board → `stats` + charts + `callout`
- Incident investigation → `timeline` + `stats` + charts; republish as it progresses
- Comparing designs / options / implementations → `compare`
- Tracking a long task → task lists + `progress`; republish as items complete
- Anything the user would otherwise paste into Slack for someone else

Do NOT publish for quick answers, code snippets, or anything terminal text handles fine.

## Naming (adapted from Claude Code's artifact-design skill)

Name the page like a product, not a caption: a short noun phrase, typically two to four
words, specific to the subject — the reader must be able to pick it out of a gallery of
many. Never a generic category label, never a name with an explainer appended after a dash
or colon. Keep the title stable across republishes.

## Craft rules

- Encode state in form, not just numbers: use `tone` fields (`good`/`bad`/`warn`) so what
  needs attention reads at a glance.
- Title the finding, not the axes — and never let an encoding exaggerate the data.
- Charts cost tokens: prefer a summarized dataset over an inlined full dump; drop
  interactivity nobody needs.
- Real content only — never lorem ipsum or placeholder data.
- Honor the project's own conventions first: if the repo documents design tokens or a brand
  palette, reflect them in chart colors (e.g. vega-lite `mark.color`).
- Pages are local files. For live auto-refresh while iterating, suggest
  `opencode-artifacts serve` (open pages reload on every republish).

## The comment loop

When a served artifact has readers, close the loop: `artifact_comments` with `digest: true`
for a triage view (unresolved first, age-marked), act on each thread, then resolve by id with
`resolveId`. If acting changed the page, republish. Leave a thread open only while the
conversation is genuinely still active.
