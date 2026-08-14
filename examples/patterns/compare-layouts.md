---
title: Settings panel — four layout directions
icon: 🧭
---

Four distinctly different layouts for the settings panel, varying density and grouping. Tradeoff under each.

```compare
[
  { "title": "A — Single column", "pill": "neutral", "annotations": ["Everything stacked, one scroll", "Search filters the list", "Zero learning curve"], "tradeoff": "Longest page; advanced users scroll past 80% they never use" },
  { "title": "B — Two-column tabs", "pill": "info", "annotations": ["Left nav: 6 groups", "Right: group content", "Deep-linkable per group"], "tradeoff": "Hides cross-group settings; best for known-item visits" },
  { "title": "C — Card grid", "pill": "neutral", "annotations": ["12 cards, one per domain", "Each card opens a modal", "Most visual"], "tradeoff": "Modals break keyboard flow; two clicks to anything" },
  { "title": "D — Dense table", "pill": "warn", "annotations": ["Every setting one row", "Inline edit, no pages", "Power-user fastest"], "tradeoff": "Intimidating for new users; needs the search box to be great" }
]
```

## Recommendation

> [!TIP]
> Ship **B** for the default and **D** behind a "density" toggle. A and C lose on both speed and scanability in the hallway tests.
