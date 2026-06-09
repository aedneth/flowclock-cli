# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-06-09

flowclock grows from a count-up HUD into a **Flowtime control center**: it now
times and categorizes your breaks, plays the "focus target / break budget" game,
gamifies your day, and ships an interactive in-terminal dashboard — all still raw
ANSI, zero new runtime dependencies, instant cold start.

### Added

- **Flowtime session model (schema → v3):** a session now tracks **categorized,
  timed breaks** alongside focus time. Each break carries a `category`
  (`rest · meal · exercise · walk · distraction · other`) plus an optional label.
  New session fields: `breaks[]`, `breakS` (total break seconds), `focusTargetS`,
  `breakBudgetS`. `durationS` keeps its meaning — **active focus seconds**.
- **The game — targets & break budgets:** `start --target 1h --break-budget 20m`
  sets a focus goal and a break allowance; the HUD shows live progress
  (`goal · 42m/1h ███████░░░ 70%`), the remaining break budget, the live
  focus:rest ratio, and a win marker (`✦`) when you hit the target within budget.
  `log` accepts `--target` / `--break-budget` too.
- **Proportional break suggestions:** a Flowtime engine (`flowtime.ts`) recommends
  a break length from how long you focused (the 10–50%-of-work bands); the HUD
  shows the suggestion when a break starts.
- **In-session break flow:** `b` starts/ends a break; `1`–`6` pick its category;
  `c` cycles category; `p` is still the quick rest toggle.
- **Visible controls footer:** the HUD now shows an elegant, dim controls line
  under the clock (like recmp3-cli) by default. **`start --zen`** (or
  `showControls=false`) restores the clock-only purist HUD.
- **Display styles:** `displayStyle` config (`simple` | `block`). The **simple**
  centered clock is now the default; the block 7-segment font is opt-in via
  `start --big` or `displayStyle=block`.
- **Gamification:** `stats` now reports a **flow score** (0–100), **daily
  maximization %** (focus vs. your `dailyFocusGoalS`), **focus:rest ratio**, and
  **achievements** (First Hour, Deep Diver, Budget Master, Flow 4:1, Streak 7,
  Century). Exposed under `stats --json` as a `game` object.
- **Interactive dashboard:** **`flowclock dashboard`** (aliases `dash`, `tui`) — a
  flicker-free, themed, navigable TUI built on a new in-house raw-ANSI toolkit
  (alt-screen + double-buffer diff renderer). Views: Overview, Sessions (+ a
  per-session focus/break timeline), Goals, and Breaks/analytics. Agent-native:
  `--json` or non-TTY emits a `DashboardSnapshot` and never requires a terminal.
- **End-of-session summary:** on stop (TTY), a short recap of focus total, break
  total by category, focus:rest ratio, and target/budget outcome.
- **MCP:** new `flowclock_dashboard` tool (returns the snapshot); `flowclock_log`
  gains `goal` / `target` / `breakBudget` inputs.
- New config keys: `displayStyle`, `showControls`, `dailyFocusGoalS` (default 4h),
  and `keybindings.break` / `keybindings.category`.

### Changed

- **Default HUD is now the simple centered clock with a visible controls footer**
  — a deliberate repositioning from "invisible HUD" to "Flowtime control center."
  Use `--zen` to get the old minimalist, control-free clock.
- **`sessions.json` schema → v3.** Migration is **non-destructive**: v1/v2 files
  load unchanged, and legacy `pauses[]` are normalized into `breaks[]` (category
  `rest`) on read so historical break analytics work immediately.
- `stats`, `history`, `summary --week` (adds **Break** + **Ratio** columns), and
  `goals` (adds break time + target/budget tallies) all reflect the new model.
- The manifest (and therefore completion + MCP discovery) advertises `dashboard`
  and the new `start`/`log` flags.

## [1.0.0] - 2026-06-03

### Added

- **Goals mode:** `start --goal "<intention>"` names a session's goal; on stop in
  a TTY a non-blocking hit/miss prompt (`y`/`n`, 3-second auto-skip = neutral)
  records `goalMet`. `log --goal` covers the headless/agent path. New
  **`goals`** command summarizes your goals (count, total time, met/missed/neutral
  tallies), learned from logged sessions; goals also show in `history`.
- **Streaks:** `stats` now reports your current and longest daily streak and last
  session date (consecutive local days with ≥1 session; counts today or
  yesterday as current). Exposed under `stats --json` as `currentStreak`,
  `longestStreak`, `lastSessionDate`.
- **Theme override:** `start --theme <neon|amber|blue|mono>` overrides the
  configured theme for one session; `doctor` now reports terminal color depth.
- **Big display:** `start --big` renders the time in a 5-row block (7-segment
  style) font and transparently falls back to the compact HUD on terminals
  narrower than 60 columns. Honors the `bigFont` config default.
- **Weekly export:** `summary --week [YYYY-WW]` prints a markdown table
  (`Date | Sessions | Total | Best | Goal`) for pasting into notes; `--json` too.
- **Shell completions:** `completion <bash|zsh|fish>` prints a sourceable script;
  `doctor` detects your shell and suggests the install command.
- **recmp3 correlation:** optional `recmp3SessionId` session field
  (`log --recmp3-session-id`) to correlate audio captures with focus time — a
  naming convention only, no dependency.

### Changed

- **`sessions.json` schema → v2** (adds `goal`, `goalMet`, `recmp3SessionId`).
  The migration is **non-destructive**: v1 files written by 0.1.0 still load and
  keep their version; new records are written at v2.
- The command manifest (and therefore the MCP server) now advertises `goals`,
  `summary`, and `completion`, plus the new `start`/`log` flags.

## [0.1.0] - 2026-06-02

### Added

- **HUD timer** (`flowclock` / `flowclock start`): a single centered `HH:MM:SS`
  count-up line rendered with raw ANSI (no Ink) for instant startup, with
  invisible `p` (pause/resume), `r` (reset), and `q`/`Ctrl-C` (stop & log)
  controls and resize-safe degradation — preserving the proven Bash UX.
- **Silent session logging** to a versioned `sessions.json` (atomic writes,
  corrupt-file recovery).
- **Commands:** `start`, `log`, `stats`, `history`, `config`, `doctor`,
  `manifest`, `mcp`.
- **Agent-native layer:** global `--json` (stable envelope), `--yes`,
  `--no-color`, deterministic POSIX exit codes (0–6), stdin/stdout
  composability, a discoverable `manifest`, and an **MCP stdio server**
  exposing `flowclock_stats`, `flowclock_history`, `flowclock_log`,
  `flowclock_config_get/set`, and `flowclock_doctor`.
- **Headless timed sessions** via `start --duration` for non-TTY/agent use.
- **Cross-OS config/data paths** (XDG / macOS / Windows) with
  `FLOWCLOCK_CONFIG_DIR` / `FLOWCLOCK_DATA_DIR` overrides.
- Color themes: `neon` (default), `amber`, `blue`, `mono`.

[Unreleased]: https://github.com/aedneth/flowclock-cli/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/aedneth/flowclock-cli/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/aedneth/flowclock-cli/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/aedneth/flowclock-cli/releases/tag/v0.1.0
