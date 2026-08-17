---
title: Renderer one-chart benchmark
lang: en
dir: ltr
locale: en-US
timezone: UTC
---
# Renderer one-chart benchmark

## Trend

```vega-lite
{"description":"Throughput rises from 12 to 21 units across four samples.","width":"container","height":320,"data":{"values":[{"sample":"A","value":12},{"sample":"B","value":15},{"sample":"C","value":18},{"sample":"D","value":21}]},"mark":"line","encoding":{"x":{"field":"sample","type":"ordinal"},"y":{"field":"value","type":"quantitative"}}}
```

```decisions
{"title":"Benchmark interaction","questions":[{"id":"continue","question":"Continue?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"}]}]}
```
