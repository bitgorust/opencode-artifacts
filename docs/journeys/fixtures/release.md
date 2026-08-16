---
title: Release 2.14 readiness
icon: ✅
source: Release tracker snapshot and staging migration run captured 2026-08-15
---

```progress
{ "label": "Release readiness", "done": 7, "total": 11 }
```

## Current state

Migration 0412 passed its staging dry run and the rollback plan is reviewed. Security sign-off
is pending, but the only hard blocker is the performance baseline because the benchmark
cluster is down.

> [!IMPORTANT]
> Restore the benchmark cluster and rerun the performance baseline before tagging.
