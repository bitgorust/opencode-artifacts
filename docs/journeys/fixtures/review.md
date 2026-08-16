---
title: PR 412 review — cache TTL configuration
icon: 🔀
source: PR 412 diff and Wednesday–Thursday deploy-failure investigation captured 2026-08-15
---

## Primary finding

The PR drops the default cache TTL from 300 seconds to 5 seconds, which would increase origin
requests roughly sixtyfold. It also leaves validation disabled, so zero or negative TTLs pass.

```callout
{ "tone": "warn", "title": "Merge decision", "body": "Restore the 300-second default and reject ttlSeconds below one before merge." }
```
