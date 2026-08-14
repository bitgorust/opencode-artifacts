---
title: Incident 4172 — Checkout latency spike
icon: 🚨
---

# Incident 4172: checkout p99 latency spike

**Status:** mitigated at 14:32, root cause confirmed.
**Impact:** 38 minutes of elevated p99 on `/checkout`, 2.1% of requests timing out.

## Timeline

| Time (UTC) | Event |
|---|---|
| 13:54 | Alert fires: p99 > 2.5s for 5m |
| 14:05 | Suspect deploy `svc-payments@1.88.0` identified |
| 14:19 | Rollback to `1.87.2` starts |
| 14:32 | p99 back under 400ms |

## Error rate by minute

```vega-lite
{
  "data": {
    "values": [
      { "minute": "13:50", "errors": 2 },
      { "minute": "13:55", "errors": 4 },
      { "minute": "14:00", "errors": 41 },
      { "minute": "14:05", "errors": 63 },
      { "minute": "14:10", "errors": 58 },
      { "minute": "14:15", "errors": 47 },
      { "minute": "14:20", "errors": 22 },
      { "minute": "14:25", "errors": 9 },
      { "minute": "14:30", "errors": 3 }
    ]
  },
  "mark": { "type": "bar" },
  "encoding": {
    "x": { "field": "minute", "type": "ordinal", "title": null },
    "y": { "field": "errors", "type": "quantitative", "title": "5xx / min" }
  }
}
```

## Latency before vs after rollback

```echarts
{
  "xAxis": { "type": "category", "data": ["13:50", "14:00", "14:10", "14:20", "14:30"] },
  "yAxis": { "type": "value", "name": "p99 (ms)" },
  "series": [{ "type": "line", "smooth": true, "data": [310, 2600, 2350, 900, 340] }]
}
```

## Broken spec (demonstrates inline error handling)

```vega-lite
{ this is not valid json }
```

## Root cause

`svc-payments@1.88.0` introduced a synchronous fraud-check call on the hot path.
See commit `a1b2c3d`. Follow-up: make the check async with a 200ms budget.
