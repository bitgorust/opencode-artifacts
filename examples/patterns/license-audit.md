---
title: Dependency license audit
icon: ⚖️
description: Every production dependency and its license, copyleft flagged
source: package-lock.json, 2026-08-15
composition: dense
---

```stats
[
  { "label": "PROD DEPENDENCIES", "value": "12", "tone": "neutral" },
  { "label": "PERMISSIVE", "value": "10", "tone": "good" },
  { "label": "COPYLEFT", "value": "2", "tone": "bad", "emphasis": true }
]
```

## Copyleft findings

```findings
[
  { "severity": "high", "title": "GPL-3.0 in the image pipeline", "location": "vendor/imgopt", "detail": "Linked into the distributed CLI. Either replace with sharp (Apache-2.0) or isolate behind a subprocess boundary." },
  { "severity": "medium", "title": "LGPL-2.1 via native binding", "location": "vendor/termui", "detail": "Dynamic linking keeps us compliant, but the notice file must ship in the release tarball." }
]
```

## All production dependencies

```table
{
  "caption": "npm ls --omit=dev",
  "columns": [
    { "key": "name", "label": "Package" },
    { "key": "version", "label": "Version" },
    { "key": "license", "label": "License" },
    { "key": "deps", "label": "Deps", "type": "num" },
    { "key": "size", "label": "Size KB", "type": "num" }
  ],
  "rows": [
    { "name": "vega", "version": "5.30.0", "license": "BSD-3", "deps": 45, "size": 1540 },
    { "name": "vega-lite", "version": "5.21.0", "license": "BSD-3", "deps": 28, "size": 980 },
    { "name": "vega-embed", "version": "6.29.0", "license": "BSD-3", "deps": 12, "size": 210 },
    { "name": "echarts", "version": "5.6.0", "license": "Apache-2.0", "deps": 2, "size": 1020 },
    { "name": "mermaid", "version": "11.16.1", "license": "MIT", "deps": 84, "size": 3560 },
    { "name": "markdown-it", "version": "14.1.0", "license": "MIT", "deps": 6, "size": 240 },
    { "name": "vendor/imgopt", "version": "1.2.0", "license": "GPL-3.0", "deps": 3, "size": 180 },
    { "name": "vendor/termui", "version": "0.9.4", "license": "LGPL-2.1", "deps": 1, "size": 96 },
    { "name": "tslib", "version": "2.8.1", "license": "0BSD", "deps": 0, "size": 18 },
    { "name": "zod", "version": "3.24.1", "license": "MIT", "deps": 0, "size": 128 },
    { "name": "fastq", "version": "1.17.1", "license": "ISC", "deps": 1, "size": 12 },
    { "name": "punycode", "version": "2.3.1", "license": "MIT", "deps": 0, "size": 14 }
  ]
}
```

> [!WARNING]
> Two copyleft packages block the next release until resolved or isolated. See the findings above.
