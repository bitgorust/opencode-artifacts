---
title: Release 2.14 checklist
icon: ✅
composition: quiet
source: Synthetic release plan, captured 2026-08-18
---

```progress
{ "label": "Release readiness", "done": 7, "total": 11 }
```

## Must land before tag

- [x] CHANGELOG entries for all 23 merged PRs
- [x] Migration 0412 dry-run on staging snapshot
- [x] Rollback plan reviewed by on-call
- [ ] Performance baseline re-run (blocked: bench cluster down)
- [ ] Security sign-off on the new token endpoint

## Post-tag

- [x] Announce in #eng-releases
- [ ] Dashboard watch for 48h
- [ ] Postmortem for incident 4172 attached to release notes

## Notes

> [!IMPORTANT]
> The performance baseline is the only hard blocker. Everything in Post-tag can land after the tag.
