---
title: Deploy failures by service — last 7 days
icon: 📊
---

A week of deploy failures across all services, with the two hotspots called out.

```stats
[
  { "label": "DEPLOYS", "value": "1,284", "delta": "4.2%", "direction": "up", "tone": "neutral" },
  { "label": "FAILURES", "value": "61", "delta": "18.0%", "direction": "up", "tone": "bad", "emphasis": true },
  { "label": "ROLLBACK RATE", "value": "4.8%", "delta": "0.6pt", "direction": "up", "tone": "bad" },
  { "label": "MEAN RECOVERY", "value": "11m", "delta": "22.4%", "direction": "down", "tone": "good" }
]
```

## Failures per day

```vega-lite
{
  "description": "Daily failures peak at 14 on Wednesday and fall to 5 by Saturday before ending at 7.",
  "data": { "values": [
    { "day": "Mon", "failures": 6 }, { "day": "Tue", "failures": 9 },
    { "day": "Wed", "failures": 14 }, { "day": "Thu", "failures": 12 },
    { "day": "Fri", "failures": 8 }, { "day": "Sat", "failures": 5 },
    { "day": "Sun", "failures": 7 }
  ]},
  "mark": { "type": "bar", "color": "#6d6bd6", "cornerRadiusTopLeft": 4, "cornerRadiusTopRight": 4 },
  "encoding": {
    "x": { "field": "day", "type": "ordinal", "title": null },
    "y": { "field": "failures", "type": "quantitative", "title": "failed deploys" }
  }
}
```

```callout
{ "tone": "warn", "title": "Wed–Thu spike is one root cause, not two", "body": "All 26 failures on Wednesday and Thursday trace to the misconfigured cache TTL shipped in platform#412. Fixing that one deploy removes 43% of the week's failures." }
```

## By service

| Service | Failures | Rollbacks | Main cause |
|---|---|---|---|
| svc-payments | 19 | 8 | cache TTL misconfig |
| svc-search | 12 | 4 | index rebuild race |
| svc-auth | 9 | 3 | cert rotation |
| svc-web | 7 | 2 | asset CDN 403s |
