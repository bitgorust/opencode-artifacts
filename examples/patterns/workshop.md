---
title: Workshop — settings panel direction
icon: 🧭
---

Answer the open decisions directly on this page. When served (`opencode-artifacts serve`), your selections persist and the session reads them back with `artifact_state` / `opencode-artifacts state`.

```decisions
{
  "title": "Open decisions",
  "questions": [
    {
      "id": "layout",
      "question": "Which layout ships as default?",
      "options": [
        { "id": "tabs", "label": "B — Two-column tabs", "note": "deep-linkable, best for known-item visits" },
        { "id": "dense", "label": "D — Dense table", "note": "power-user fastest, needs great search" },
        { "id": "column", "label": "A — Single column", "note": "zero learning curve, longest page" }
      ]
    },
    {
      "id": "density-toggle",
      "question": "Ship the density toggle in the same PR?",
      "options": [
        { "id": "yes", "label": "Yes, same PR", "note": "one release note, bigger blast radius" },
        { "id": "no", "label": "Follow-up PR", "note": "safer rollout, toggle ships dark first" }
      ]
    }
  ]
}
```

## Context

The four candidate layouts with tradeoffs are on the compare page. This workshop page is only for the two decisions blocking the build.
