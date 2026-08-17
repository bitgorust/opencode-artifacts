---
title: Signal Review
icon: ◈
description: A bounded project visual system applied without raw CSS.
theme: report
---
```design-tokens
{"schemaVersion":1,"tokens":{"pageBackground":"#f5f1ff","surface":"#ffffff","text":"#211735","mutedText":"#5e5074","border":"#d9d0e8","accent":"#6d28d9","font":"serif","spacing":"spacious","radius":"soft","density":"airy"}}
```

# Signal Review

The explicit document tokens outrank the report theme while retaining a fixed, offline
renderer and validated contrast.

```stats
[
  {"label":"Qualified signals","value":"148","delta":"+19%","direction":"up","tone":"good","emphasis":true},
  {"label":"Needs review","value":"23","delta":"-8%","direction":"down","tone":"warn"},
  {"label":"Confidence","value":"92%","delta":"high","tone":"neutral"}
]
```

## Readout

```callout
{"tone":"info","title":"The system stays declarative","body":"Colors, type, spacing, radius, and density flow through allowlisted slots. Selectors, URLs, markup, imports, and executable expressions never enter the page CSS."}
```

## Provenance

```table
{
  "caption":"Effective design decisions",
  "columns":[
    {"key":"layer","label":"Layer"},
    {"key":"decision","label":"Decision"},
    {"key":"source","label":"Winning source"}
  ],
  "rows":[
    {"layer":"Color","decision":"Violet accent on lavender canvas","source":"Prompt fence"},
    {"layer":"Spacing","decision":"Spacious rhythm","source":"Prompt fence"},
    {"layer":"Structure","decision":"Fixed responsive renderer","source":"Built-in"}
  ]
}
```

> [!NOTE]
> The generated page records token provenance in metadata and makes no view-time request.
