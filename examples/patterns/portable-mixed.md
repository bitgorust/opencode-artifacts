---
title: Portable release pulse
icon: 🧳
description: Offline mixed-content fixture for the portable renderer gate
source: repository-authored synthetic release data, 2026-08-17
---

This fixture combines a contained local image, a chart, a semantic table, and keyboard-operable
controls in one strict-CSP file.

![Deploy-failure dashboard used as a contained local image](docs/evidence/patterns/dashboard.png)

## Weekly readiness

```vega-lite
{
  "data": { "values": [
    { "day": "Mon", "ready": 61 },
    { "day": "Tue", "ready": 68 },
    { "day": "Wed", "ready": 76 },
    { "day": "Thu", "ready": 84 },
    { "day": "Fri", "ready": 92 }
  ]},
  "mark": { "type": "line", "point": true, "color": "#6d6bd6" },
  "encoding": {
    "x": { "field": "day", "type": "ordinal", "title": null },
    "y": { "field": "ready", "type": "quantitative", "title": "readiness %", "scale": { "domain": [0, 100] } }
  }
}
```

```table
{
  "caption": "Portable gate checks",
  "columns": [
    { "key": "surface", "label": "Surface" },
    { "key": "result", "label": "Result" },
    { "key": "bytes", "label": "Bytes", "type": "num" }
  ],
  "rows": [
    { "surface": "Local image", "result": "embedded", "bytes": 1 },
    { "surface": "Chart runtime", "result": "conditional", "bytes": 2 },
    { "surface": "Viewer requests", "result": "zero", "bytes": 0 }
  ]
}
```

## Release decision

```decisions
{
  "title": "Portable candidate",
  "questions": [
    {
      "id": "candidate",
      "question": "Does this candidate preserve the offline contract?",
      "options": [
        { "id": "yes", "label": "Yes", "note": "Record the browser evidence" },
        { "id": "no", "label": "No", "note": "Keep the gate failed" }
      ]
    }
  ]
}
```
