---
type: index
created: 2026-05-03
tags: [bugs, brain]
---

# Bugs

Bug → fix narratives for `korvex-web`. Capture the *why*, not just the patch
(the patch is in the commit; this folder is for the lesson).

## File naming

`YYYY-MM-DD-<slug>.md`.

## Required frontmatter

```yaml
---
type: bug
project: korvex
status: open | fixed | wontfix
date: YYYY-MM-DD
severity: low | medium | high
related-commits: [<sha>, ...]
tags: [bug, korvex]
---
```

Bugs with `status: open` are surfaced in `_CONTEXT.md` at session start.
