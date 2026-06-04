---
type: decision
project: flowclock-cli
status: adopted
date: 2026-06-03
reversal-cost: low
review-by:
tags: [decision, flowclock-cli, hud]
---

# `--big` uses a hand-authored 5-row block font, no dependency

## Context

The `--big` flag renders the time in large characters. Options ranged from a
figlet/FIGfont dependency, to programmatic 7-segment rendering, to a small
hand-authored block font.

## Decision

A **hand-authored 5-row block font** in `src/lib/bigfont.ts`, covering only the
glyphs a clock needs: digits `0–9` and `:`.

- **No dependency.** The whole point of flowclock is an instant cold start on a
  tiny dependency surface (raw ANSI, not Ink). Pulling figlet for one flag
  contradicts that. The font is a static lookup table — kilobytes, zero deps.
- **Only the needed glyphs.** Digits + colon keeps the table tiny and legible;
  unknown characters render as a blank cell so the renderer never throws.
- **Graceful fallback is mandatory.** `renderBigFrame()` returns `""` when the
  terminal is shorter than 5 rows or narrower than `BIG_MIN_COLS` (60), and the
  caller falls back to the compact HUD. This upholds the project principle:
  degrade to nothing rather than draw partial garbage. A full `HH:MM:SS` is 43
  columns, comfortably inside the 60-column gate.

## Consequences

- Adding glyphs later (e.g. an `--big` label line) means extending the table.
- Low reversal cost — purely presentational, isolated to `bigfont.ts` +
  `renderBigFrame()`, fully unit-tested in `test/bigfont.test.ts`.
