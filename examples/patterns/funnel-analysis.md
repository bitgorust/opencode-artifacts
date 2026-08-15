---
title: Export funnel drop at v4.2
icon: 📉
description: Completion didn't sag — it snapped the day the paywall moved up front
theme: report
---

```stats
[
  { "label": "EDITOR SESSIONS", "value": "8.41M", "delta": "3.1%", "direction": "up", "tone": "neutral" },
  { "label": "EXPORT TAPS", "value": "4.99M", "delta": "2.4%", "direction": "up", "tone": "neutral" },
  { "label": "EXPORT COMPLETION", "value": "27.8%", "delta": "9.4pt", "direction": "down", "tone": "bad", "emphasis": true },
  { "label": "PRO CONVERSIONS", "value": "188.4K", "delta": "1.8%", "direction": "down", "tone": "bad", "emphasis": true }
]
```

## The funnel didn't sag — it snapped

```vega-lite
{
  "data": { "values": [
    {"day": "Mar 11", "rate": 33.4}, {"day": "Mar 12", "rate": 33.1}, {"day": "Mar 13", "rate": 33.8},
    {"day": "Mar 14", "rate": 32.9}, {"day": "Mar 15", "rate": 33.5}, {"day": "Mar 16", "rate": 33.2},
    {"day": "Mar 17", "rate": 33.6}, {"day": "Mar 18", "rate": 33.4}, {"day": "Mar 19", "rate": 24.3},
    {"day": "Mar 20", "rate": 24.6}, {"day": "Mar 21", "rate": 24.1}, {"day": "Mar 22", "rate": 24.8},
    {"day": "Mar 23", "rate": 24.2}, {"day": "Mar 24", "rate": 24.5}
  ]},
  "layer": [
    {
      "mark": { "type": "area", "color": "#6d6bd6", "opacity": 0.25, "line": { "color": "#6d6bd6" }, "clip": true },
      "encoding": {
        "x": { "field": "day", "type": "ordinal", "title": null, "axis": { "labelAngle": -45 } },
        "y": { "field": "rate", "type": "quantitative", "title": "completion %", "scale": { "domain": [20, 36] } }
      }
    },
    {
      "data": { "values": [{"day": "Mar 18"}] },
      "mark": { "type": "rule", "color": "#b4541e", "strokeDash": [4, 4] },
      "encoding": { "x": { "field": "day", "type": "ordinal" } }
    },
    {
      "data": { "values": [{"day": "Mar 18", "rate": 35, "label": "v4.2 ships — paywall first"}] },
      "mark": { "type": "text", "color": "#b4541e", "align": "left", "dx": 6, "dy": -4 },
      "encoding": { "x": { "field": "day", "type": "ordinal" }, "y": { "field": "rate", "type": "quantitative" }, "text": { "field": "label" } }
    }
  ]
}
```

```callout
{ "tone": "warn", "title": "Cancels are reflexes, not deliberation", "body": "68% of abandons bail inside three seconds — no scroll, no option tap. The ask moved before the value moment, and users answer on autopilot." }
```

## What changed between 4.1 and 4.2

```compare
[
  { "title": "4.1 — Before", "pill": "good", "annotations": ["Free default preselected", "Pro offer after first successful export", "CTA: continue"], "tradeoff": "Slower revenue, higher trust" },
  { "title": "4.2 — Current", "pill": "bad", "annotations": ["Pro preselected — price is first paint", "CTA sells the plan, not the export"], "tradeoff": "Higher intent, darker pattern — completion fell 9.4pt overnight" }
]
```

## Recommendation

> [!IMPORTANT]
> Restore the free default and move the ask to after the first successful export. Expected recovery: 6–8pt of completion within one release cycle, based on the 4.1 baseline mix.
