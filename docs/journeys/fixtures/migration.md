---
title: Migration plan — sessions to Postgres
icon: 🗺️
source: Session architecture notes and 30-day volume assumptions captured 2026-08-15
---

```progress
{ "label": "Plan confidence", "done": 4, "total": 6 }
```

## Current state

The three-deploy dual-write/backfill/cutover approach is defined. Open risks are silent
dual-write drift and index choices that have not been benchmarked at 30-day volume.

## Next action

Decide retention for anonymous sessions and benchmark the proposed indexes before Phase 2
sign-off.
