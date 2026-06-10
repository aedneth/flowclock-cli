# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.2.0] - 2026-06-10

Refines the `simple` display style into a clean line font, adds a third
`outline` style, and fixes a toggle that looked broken on small windows.

### Added

- **New `outline` display style.** The hollow, edge-traced block clock shipped in
  v3.1.0 is now a **selectable style in its own right**. The display cycle is
  `block → simple → outline` (press `d`, or `display` in the `/` palette). All
  three are saved to your config.

### Changed

- **`simple` is now a clean heavy line font.** Instead of the edge-traced
  outline, `simple` renders crisp seven-segment digits in heavy box-drawing
  strokes (`┏━┓ ┃ ┣━┫ ┗━┛`) — minimal and airy, but scaled to the same
  hero dimensions as `block` (it shares the exact reserve-first geometry).
  (`renderSimpleLines` in bigfont; the old outline lives on as the `outline`
  style via `renderOutlineLines`.)

### Fixed

- **Display-style toggle now visibly changes on small / tiled windows.** The old
  outline coincided pixel-for-pixel with `block` at scale 1, so pressing `d` in a
  small window appeared to do nothing — the difference only showed once the
  window was large enough to scale up. The `simple` line font differs from
  `block` at **every** scale (including scale 1), so the toggle is always visible.

### Notes

- **Public default is unchanged: `displayStyle` stays `block`** for everyone.
- The standalone `--bare`/`--zen` HUD still renders the compact single line for
  any non-`block` style; the scaled line fonts are a dashboard feature.

## [3.1.0] - 2026-06-10

A usability follow-up to v3: you can now configure and start everything from
inside the dashboard, and the minimalist `simple` display style finally gets the
same scaling the `block` style already had.

### Added

- **In-dashboard new-session form.** On the idle Session view, press `s`, `n`, or
  `Enter` (or run `start` from the `/` palette) to open a centered form for the
  session **goal**, **name**, **focus target**, and **break budget** — no need to
  drop to the shell. `Tab`/`↑↓` move between fields, `Enter` starts, `Esc` cancels.
  Invalid durations are reported inline instead of starting the session.
- **Live, persisted display-style toggle.** Press `d` (or run `display` from the
  palette) to switch the Session counter between `block` (solid) and `simple`
  (minimal outline). The choice is **saved to your config** as the new default.
- **Live, persisted theme switch via `t`.** The `t` key cycles the theme and now
  **persists** it (the palette `theme` command persists too) — previously theme
  switches were in-memory only.
- **Scaled `simple` display style.** The minimalist clock now shares the `block`
  style's exact reserve-first scaling and dimensions, rendered as a large hollow
  outline instead of a tiny single text line. (`renderOutlineLines` in bigfont.)

### Changed

- The `/` palette `start` command now opens the new-session form instead of
  immediately starting a blank session.
- Session-view footer and Help view document the new `d`/`t` toggles and the form.

### Notes

- **Public default is unchanged: `displayStyle` stays `block`** for everyone. The
  scaled `simple` style is an opt-in alternate you can toggle to and compare.
- Data schema unchanged (still v3). All headless/agent/`--json`/non-TTY contracts
  are unchanged. No new dependencies.

## [3.0.0] - 2026-06-09

flowclock v3 unifies everything into **the interactive dashboard as the default
command**. Running `flowclock` with no subcommand now opens the dashboard directly
— a live, themed control center that hosts sessions, stats, goals, breaks, and
help in one place. The session experience gets a major upgrade: a **Session hero
view** with a big, balanced live counter takes centre stage, with full session
controls embedded inside the dashboard.

### Added

- **Unified interactive dashboard as the default command.** `flowclock` with no
  subcommand now opens the dashboard. The old "start a session" default is the
  breaking change motivating the v3 major bump.
- **Session hero view** inside the dashboard: a **big balanced live counter**
  (scales "reserve-first" so it stays prominent without overshadowing metadata),
  goal line, focus-target progress bar, break budget, focus:rest ratio, and a
  per-context controls footer — all rendered live inside the running dashboard.
- **Help view** (view 6 — `6` or Tab to reach) for newcomers: describes all
  views, key bindings, and common workflows.
- **Optional `/` command palette** — a transient, centered overlay triggered by
  `/`. Dismiss with `Esc`. It is **not** a permanent bar — it appears only when
  invoked, keeping the dashboard chrome minimal.
- **Live session hosting** in the dashboard: start, pause, break, pick category,
  reset, and stop entirely from within the dashboard. Session state persists on
  stop, exactly as before.
- **`start --bare`** — routes `flowclock start` to the old standalone HUD,
  bypassing the dashboard. Headless/`--duration`/non-TTY/`--json`/`--zen` paths
  are unchanged.
- **`dashboard --view <name>`** — open the dashboard directly on a named view:
  `session`, `overview`, `sessions`, `goals`, `breaks`, or `help`.
- **Live theme switching** inside the dashboard without restarting.

### Changed

- **`flowclock` with no subcommand now opens the dashboard** (was: start a
  session). This is the breaking change motivating the major version bump.
- **Default `displayStyle` is now `block`** (big 7-segment counter). `simple`
  and `--zen` remain compact opt-ins; `config set displayStyle simple` restores
  the compact clock.
- **Counter scaling is now "reserve-first"**: the big counter always gets ample
  vertical space before the surrounding metadata is rendered, so it never
  appears cramped in standard terminal sizes.
- The dashboard now exposes six named views: **1 Session · 2 Overview ·
  3 Sessions · 4 Goals · 5 Breaks · 6 Help**, navigable by Tab or number keys.
- The `start` command description updated to reflect that in a TTY it routes
  into the dashboard's Session view (unless `--bare` is supplied).
- `doctor` TTY check now reports "dashboard is the default; --bare for
  standalone HUD" when a TTY is detected.

### Fixed

- The counter no longer renders tiny in the default display path — the big
  counter is now first-class, not opt-in extra.
- The big counter no longer overshadows surrounding session info — reserve-first
  scaling keeps metadata visible alongside the hero clock.

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

[Unreleased]: https://github.com/aedneth/flowclock-cli/compare/v3.2.0...HEAD
[3.2.0]: https://github.com/aedneth/flowclock-cli/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/aedneth/flowclock-cli/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/aedneth/flowclock-cli/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/aedneth/flowclock-cli/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/aedneth/flowclock-cli/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/aedneth/flowclock-cli/releases/tag/v0.1.0
