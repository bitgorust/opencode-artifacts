---
title: Tuning playground — wave parameters
icon: 🎛️
composition: full
source: Synthetic tuning inputs, captured 2026-08-18
---

Drag the sliders: the charts update live. When the shape looks right, copy the values back into the session.

## Frequency and amplitude

```vega-lite
{
  "description": "Interactive controls change the frequency and amplitude of the displayed sine wave.",
  "params": [
    { "name": "freq", "value": 2, "bind": { "input": "range", "min": 0.5, "max": 8, "step": 0.5, "name": "Frequency " } },
    { "name": "amp", "value": 1, "bind": { "input": "range", "min": 0.2, "max": 3, "step": 0.2, "name": "Amplitude " } }
  ],
  "data": { "sequence": { "start": 0, "stop": 6.28, "step": 0.02, "as": "x" } },
  "transform": [{ "calculate": "sin(datum.x * freq) * amp", "as": "y" }],
  "mark": { "type": "line", "color": "#6d6bd6" },
  "encoding": {
    "x": { "field": "x", "type": "quantitative", "title": null },
    "y": { "field": "y", "type": "quantitative", "title": null, "scale": { "domain": [-3.2, 3.2] } }
  }
}
```

## Noisy series with zoom

```echarts
{
  "description": "The twelve-week series rises overall from 12 to 40 with several temporary dips.",
  "xAxis": { "type": "category", "data": ["W1","W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12"] },
  "yAxis": { "type": "value" },
  "dataZoom": [{ "type": "slider" }],
  "series": [{ "type": "line", "smooth": true, "data": [12, 19, 15, 22, 18, 26, 24, 31, 29, 35, 33, 40] }]
}
```

## Bring the result back

```copy
{ "label": "Copy as prompt", "text": "Apply these tuned values: freq=<your final freq>, amp=<your final amp>. Regenerate the transition preview with them." }
```

> [!TIP]
> Vega-Lite `params` with `bind` render as native sliders, and ECharts `dataZoom` gives pan/zoom — both work inside the artifact CSP with no custom JavaScript.
