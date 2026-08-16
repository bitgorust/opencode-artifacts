# Spec-anchored development

This directory separates current shipped behavior from proposed changes. The governing
decision is [ADR 0001](../docs/adr/0001-spec-anchored-development.md).

## Sources of truth

- [`docs/product-spec.md`](../docs/product-spec.md) is the normative target contract.
- [`docs/engineering-principles.md`](../docs/engineering-principles.md) governs engineering
  decisions.
- [`current/`](current/) describes observable behavior known to ship now.
- [`changes/`](changes/) contains active, approved-or-pending deltas.
- [`archive/`](archive/) preserves verified decision history.

The roadmap sequences target work. Tests and evidence support claims. Neither silently
redefines a requirement.

## Choose a lane

- **Trivial:** no observable behavior or governed invariant changes, or a bug is restored to
  an already explicit current spec. No packet is required.
- **Standard:** behavior, a public contract, or a normative requirement changes.
- **High-risk:** security, privacy, authorization, concurrency, durability, migration,
  destructive action, public compatibility, or an irreversible decision changes.

When uncertain, use the higher lane.

## Commands

```text
npm run spec -- new <change-id> --lane standard --title "Short outcome"
npm run spec -- validate <change-id> --phase proposal
npm run spec -- validate <change-id> --phase implementation
npm run spec -- validate <change-id> --phase archive
npm run spec -- archive <change-id>
npm run spec -- withdraw <change-id> --by "<actor>" --reason "<reason>"
```

Use a lowercase kebab-case change ID. A high-risk packet also contains `design.md`.

## Workflow

1. Scaffold a standard or high-risk packet.
2. Fill proposal and delta scenarios. Keep unresolved decisions marked
   `[NEEDS CLARIFICATION]`.
3. Run proposal validation and obtain human approval by editing `change.json`.
4. Run implementation validation, then implement the approved tasks with tests. If a draft,
   approved, or implementing direction is abandoned before it updates current truth, withdraw
   it with an actor and reason instead of labeling it verified.
5. Add exact validation and verification evidence for every affected requirement.
6. Update the affected current-spec files and list them in `change.json`.
7. Set status to `verified`, check every task, validate the archive phase, and archive.

A withdrawn packet is retained with status `withdrawn` and an archive date. It does not need
completed deltas, tasks, evidence, or current-spec updates, and it never counts as delivered
behavior. Verified packets cannot be withdrawn.

If implementation evidence contradicts the packet, amend and reapprove the packet. Do not
quietly change either the code or target to make the mismatch disappear.

## Brownfield adoption

Do not invent a complete current specification from incomplete repository archaeology.
Before the first standard or high-risk change in a domain, add or improve only the affected
`current/*.spec.md` file, grounding every statement in code and evidence. Coverage therefore
grows at the same boundary where it is reviewed.
