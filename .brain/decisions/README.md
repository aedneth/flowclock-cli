---
type: index
created: 2026-05-03
tags: [decisions, brain]
---

# Decisions

Decision logs for `korvex-web`. CKIS format — see
`~/Documents/Second Brain/00-system/ckis/06-decision-execution-and-review-protocol.md`.

## File naming

`YYYY-MM-DD-<slug>.md` — one decision per file.

## Required frontmatter

```yaml
---
type: decision
project: korvex
status: proposed | adopted | superseded
date: YYYY-MM-DD
reversal-cost: low | medium | high
review-by: YYYY-MM-DD or empty
tags: [decision, korvex]
---
```

Decisions with `status: proposed` are surfaced in `_CONTEXT.md` at session start
and in CKIS `_MEMORY.md` Open Decisions. Important decisions are cross-posted
to `_MEMORY.md` as one-line entries pointing back here.
