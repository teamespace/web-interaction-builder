---
type: llm
focus: trace
weight: 1
---

Smoothing in the per-frame loop is time-based (uses a frame delta such as dt or an exponential decay with time), not a fixed per-frame lerp factor like x += (t - x) * 0.1.
