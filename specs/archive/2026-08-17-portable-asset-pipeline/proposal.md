# Proposal: Add a contained offline asset pipeline

## Outcome

Markdown artifacts can declare contained local images, SVG, fonts, and supported media and
receive one self-contained offline HTML file whose final bytes and provenance are verified.

## Context

The renderer currently bundles code runtimes but has no declared worktree-asset contract.
Ordinary image references can therefore remain external, break under the strict CSP, escape
the intended root, or bypass the final 15 MiB accounting boundary.

## Scope

- In scope: declared worktree-root resolution, realpath containment, regular-file checks,
  content-based MIME validation, allowlisted formats, per-asset/count/aggregate bounds, data
  URI embedding, alt-text diagnostics, provenance, final-byte accounting, and explicit
  missing/external/unsupported failures.
- Out of scope: network fetching, remote import, arbitrary SVG script execution, project CSS,
  secret scanning changes, asset optimization that changes bytes, or broad font licensing.

## Risks and rollback

- Risk: path/symlink escape, decompression/resource abuse, mislabeled content, SVG active
  content, private-file disclosure, and a footer/asset expansion that exceeds the cap.
- Rollback: disable declared assets and return actionable preflight failures; existing pages
  remain standalone and the pre-asset Markdown behavior remains available.

## Validation plan

Use synthetic contained/escaping/missing/mislabeled/oversized assets, a property model for
resolution and byte accounting, offline browser request observation, final-file secret scan,
and a representative page containing an image, chart, table, and controls.
