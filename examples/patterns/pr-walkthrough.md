---
title: PR #412 walkthrough — cache TTL config
icon: 🔀
composition: split
source: Synthetic PR diff, captured 2026-08-18
---

One config change, one default flipped, one test gap. Reviewers should read the findings top to bottom, then the diff.

```findings
[
  { "severity": "high", "title": "Default TTL dropped from 300s to 5s", "location": "config/cache.ts:14", "detail": "Any service reading the default now hammers the origin 60x harder. This is the Wed–Thu deploy-failure spike." },
  { "severity": "medium", "title": "No validation on ttlSeconds", "location": "config/cache.ts:22", "detail": "A zero or negative value passes silently and disables caching." },
  { "severity": "low", "title": "Flag name is ambiguous", "location": "config/cache.ts:9", "detail": "useShortTtl reads as temporary. Prefer ttlSeconds with an explicit value." }
]
```

## The change

```diff
@@ config/cache.ts
-export const DEFAULT_TTL_SECONDS = 300;
+export const DEFAULT_TTL_SECONDS = 5;
## note: drive-by change inside the feature flag commit — not mentioned in the PR description
 export function cacheConfig(flags: Flags) {
   return {
-    ttl: flags.ttlSeconds ?? DEFAULT_TTL_SECONDS,
+    ttl: flags.ttlSeconds ?? DEFAULT_TTL_SECONDS,
     validate: false,
   };
 }
## note: validate stays false — see medium finding above
```

## Verdict

> [!WARNING]
> Safe to merge only after the default goes back to 300 and `validate` rejects ttl < 1. The feature flag itself is fine.

```copy
{ "label": "Copy review verdict", "text": "Request changes on PR #412: restore DEFAULT_TTL_SECONDS to 300 and reject ttlSeconds values below 1. The feature flag itself is acceptable after those fixes." }
```
