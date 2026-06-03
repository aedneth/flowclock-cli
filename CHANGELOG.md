# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/aedneth/flowclock-cli/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aedneth/flowclock-cli/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/aedneth/flowclock-cli/releases/tag/v0.1.0
