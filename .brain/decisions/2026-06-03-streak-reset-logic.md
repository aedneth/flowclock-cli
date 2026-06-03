---
type: decision
project: flowclock-cli
status: adopted
date: 2026-06-03
reversal-cost: low
review-by:
tags: [decision, flowclock-cli, stats]
---

# Streaks count local calendar days; "current" allows a one-day grace

## Context

`stats` gained current/longest streaks. Two ambiguities had to be pinned down:
the day boundary, and whether a streak is still "current" before you've logged
anything today.

## Decision

- **Day granularity, local time.** A day is "active" if it has ≥1 session, keyed
  by the same `localDateKey()` already used for the weekly buckets. Consistency
  with the rest of `stats` matters more than UTC purity, and matches how a person
  experiences "today."
- **One-day grace for the current streak.** The streak is "current" if the most
  recent active day is **today or yesterday**; we then count consecutive active
  days back from that anchor. Rationale: at 9am you haven't necessarily logged
  today yet, but your streak isn't broken — it breaks only once a full day passes
  with no session. If the most recent active day is older than yesterday,
  `currentStreak = 0`.
- **`longestStreak`** is the max run of consecutive active days over all history,
  independent of the grace rule.
- Multiple sessions in one day collapse to a single active day (a `Set`).

Implemented as the pure, unit-tested `computeStreaks(activeKeys, now)` in
`src/lib/stats.ts` (`test/stats.test.ts` covers continuation, gap, yesterday
anchor, stale, dedupe, and first-run).

## Consequences

- Timezone changes/travel can nudge a boundary; acceptable for a personal tool.
- Low reversal cost — streaks are derived at read time from sessions, never
  stored, so the rule can change without any data migration.
