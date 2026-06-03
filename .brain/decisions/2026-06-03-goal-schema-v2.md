---
type: decision
project: flowclock-cli
status: adopted
date: 2026-06-03
reversal-cost: medium
review-by:
tags: [decision, flowclock-cli, schema]
---

# Goals stored as first-class session fields (schema v2), not reusing `label`

## Context

v0.1.0 sessions already had a free-text `label`. Goals mode needed to attach an
intention to a session and later record whether it was met. Two options:

1. Overload `label` for the goal text and infer met/missed elsewhere.
2. Add dedicated `goal`, `goalMet`, and `recmp3SessionId` fields and bump the
   on-disk schema from v1 → v2.

## Decision

Chose **option 2** — dedicated fields, `SESSION_SCHEMA_VERSION = 2`.

- `label` and `goal` are semantically different: a label is a free tag; a goal is
  a tracked intention with a hit/miss outcome. Overloading would make `goals`
  rollups and any future analytics ambiguous.
- The migration is **non-destructive**: `SessionSchema.schemaVersion` accepts a
  `union([literal(1), literal(2)])`, and the new fields default to `null`, so v1
  `sessions.json` files written by 0.1.0 still load and keep `schemaVersion: 1`.
  New records are written at v2. Verified by `test/session.test.ts`.
- `recmp3SessionId` rode along in the same bump (cheaper than a future v3) as a
  naming-convention-only correlation field — no dependency on recmp3-cli.

## Consequences

- Reading mixed-version files is supported indefinitely; we never rewrite old
  records destructively.
- A future field addition is a v3 bump following the same widening pattern.
- Reversal cost is medium: dropping the fields would orphan data already written
  by ≥1.0.0 users.
