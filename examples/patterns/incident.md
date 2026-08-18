---
title: Incident 4172 — Checkout latency spike
icon: 🚨
---

```stats
[
  { "label": "DURATION", "value": "38m", "tone": "neutral" },
  { "label": "PEAK P99", "value": "2.6s", "tone": "bad", "emphasis": true },
  { "label": "TIMEOUTS", "value": "2.1%", "delta": "of requests", "tone": "bad" },
  { "label": "TIME TO MITIGATE", "value": "25m", "delta": "12%", "direction": "down", "tone": "good" }
]
```

## Timeline

```timeline
[
  { "time": "13:54", "title": "Alert fires", "detail": "p99 > 2.5s for 5 minutes on /checkout", "tone": "bad" },
  { "time": "14:05", "title": "Suspect identified", "detail": "svc-payments@1.88.0 deployed 13:47, adds sync fraud check", "tone": "warn" },
  { "time": "14:19", "title": "Rollback starts", "detail": "back to 1.87.2", "tone": "neutral" },
  { "time": "14:32", "title": "Mitigated", "detail": "p99 back under 400ms, timeouts at baseline", "tone": "good" }
]
```

## Error rate by minute

```echarts
{
  "description": "Server errors spike from 4 to 63 per minute at 14:05, then recover to 3 by 14:30.",
  "xAxis": { "type": "category", "data": ["13:50", "13:55", "14:00", "14:05", "14:10", "14:15", "14:20", "14:25", "14:30"] },
  "yAxis": { "type": "value", "name": "5xx / min" },
  "series": [{ "type": "line", "areaStyle": {}, "smooth": true, "data": [2, 4, 41, 63, 58, 47, 22, 9, 3] }]
}
```

```callout
{ "tone": "info", "title": "Root cause: synchronous fraud check on the hot path", "body": "svc-payments@1.88.0 calls the fraud service inline before responding. p99 tracks the fraud service's own tail latency exactly. Follow-up: async with a 200ms budget, default-allow on timeout." }
```

## What we tested

- [x] Reproduced with fraud-check latency injection at 800ms
- [x] Rollback confirmed p99 recovery in 3 consecutive minutes
- [x] No order-loss events in the window (checked ledger)
- [ ] Async fraud-check implementation (tracked in PAY-2210)
