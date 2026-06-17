<div align="center">

# flowclock

**Your Flowtime control center, in the terminal.**

A count-up focus timer that **times and categorizes your breaks**, plays the
*focus-target / break-budget* game, gamifies your day, and ships an interactive
in-terminal dashboard — raw ANSI, zero runtime bloat, instant cold start.
Built for **humans and AI agents** alike, like `gh` and `vercel`.

[![CI](https://github.com/aedneth/flowclock-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/aedneth/flowclock-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/flowclock-cli.svg)](https://www.npmjs.com/package/flowclock-cli)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commercial-blue.svg)](#license)

</div>

---

## Why Flowtime, not Pomodoro

Pomodoro interrupts you every 25 minutes whether you're stuck or in deep flow.
**[Flowtime](https://en.wikipedia.org/wiki/Timeboxing) counts up and gets out of
the way** — you pick one task, work until your focus naturally fades, log it, and
take a break **proportional** to how long you worked. It respects your internal
cognitive rhythm instead of fighting it.

flowclock turns that technique into a measurable, gamified system. The premise:
*what gets measured gets optimized.* Track focus vs. rest, hit daily targets, keep
streaks alive, and earn the dopamine of a rising flow score — so coming back to
deep work becomes the path of least resistance.

| | Flowtime (flowclock) | Pomodoro |
| --- | --- | --- |
| **Work intervals** | Variable — until focus fades | Fixed 25 min |
| **Breaks** | Proportional (~10–50% of work) | Fixed 5 min |
| **Control** | Internal — you decide | External — the timer decides |
| **Best for** | Deep, creative, unpredictable work | Repetitive tasks, procrastination |

It started as a production-proven Bash HUD used daily; this is the cross-platform,
agent-native evolution that keeps that minimalist core and builds a whole
productivity instrument around it.

## Install

```bash
npm install -g flowclock-cli
```

Requires **Node.js 20+**. Works on Linux, macOS, and Windows (iTerm2, Kitty,
Alacritty, Windows Terminal, GNOME Terminal, …).

## Quickstart

```bash
flowclock                                        # open the dashboard (default — v3)
flowclock start --goal "Deep work — StreamNet" \
                --target 1h --break-budget 20m   # start a session inside the dashboard
flowclock start --bare                           # standalone HUD, bypasses the dashboard
flowclock stats                                  # flow score, ratio, streak, achievements
```

`flowclock` with no subcommand opens the **interactive dashboard** directly —
your Flowtime control center. From there you start, pause, take breaks, and stop
sessions without leaving the TUI. Use **`Tab`** or **`1`–`6`** to switch views.

## The HUD

`flowclock start --bare` opens a clean, centered standalone clock with a discreet
controls footer (bypassing the dashboard). In a normal TTY, `flowclock start`
routes you into the dashboard's Session hero view instead — same controls, richer
context. The HUD is also used for headless/`--duration`/non-TTY runs.

```
                              00:42:17

         Ship v2 · 42m/1h ███████░░░ 70%   break 06:00/20:00 · ratio 1:7.0
              [p] pause   [b] break   [r] reset   [q] stop
```

- **`p`** quick pause/resume (a quick *rest* break)
- **`b`** start/end a break — then **`1`–`6`** pick its category, **`c`** cycles
- **`r`** reset · **`q`** / **`Ctrl-C`** stop & log

Prefer the old distraction-free clock? **`flowclock start --zen`** hides the footer
and progress entirely — just the time, nothing competing for your attention.

### Timed breaks, by category

When you press **`b`**, the timer freezes your focus clock and starts counting the
break, suggesting a proportional length:

```
                              00:42:17

              ☕ BREAK · meal · 12:03   suggested 09:00
       [1]rest [2]meal [3]exercise [4]walk [5]distraction [6]other   [b] resume
```

Every break is logged with its category — so you can later see how much of your day
went to meals vs. the gym vs. actual distraction, all measured against focus time.

## The game: targets & break budgets

The Flowtime "portion" method: commit to a block of focus and a budget of rest, then
fill the focus while staying under the break budget.

```bash
flowclock start --goal "Deep work on StreamNet" --target 1h --break-budget 20m
```

The HUD tracks both live. Hit your focus target **within** the break budget and the
progress line earns a **`✦`** win marker. On stop you get a recap:

```
Focus   1h 02m 00s   ✦ target met
Breaks     14m 30s   (under 20m budget) — meal 12m, walk 02m 30s
Ratio   1:4.3 focus:rest
```

## Display styles & themes

- **`displayStyle`** — six looks for the big counter in the Session hero view,
  all sharing the same reserve-first scaling. Cycle live in the dashboard with
  **`d`** (or `config set displayStyle …`):
  - **`block`** (default) — solid 7-segment glyphs.
  - **`simple`** — clean **heavy** line digits in box-drawing strokes (`┏━┓ ┃
    ┣━┫ ┗━┛`). Minimal and airy, but full hero size.
  - **`outline`** — hollow **silhouette** of the block font rendered in
    **DOUBLE-LINE** box-drawing characters (`╔═╗ ║ ╚╝`): each digit is a
    distinctive double-walled nested-rectangle. Visually distinct from
    `minimal` at every scale, including scale 1 (minimized windows).
  - **`minimal`** — clean **light** line digits in box-drawing strokes (`┌─┐ │
    └─┘`, airy `○` colon). Scales crisply at every size.
  - **`classic`** — solid **cornered "rounded-terminal" numerals** (a distinct,
    stylized glyph shape), sharing the exact 5-row × 4-col footprint of every
    other style.
  - **`bold`** — solid **heavy-slab numerals** (a distinct, heavier glyph shape),
    sharing the exact 5-row × 4-col footprint of every other style.

  The goal sits **centered** above the counter and the focus/break metadata
  centered below it. Override the standalone HUD per session with `start --big`.

  ```
  block            simple           outline
  ████  ████       ┏━━┓ ┏━━┓        ╔══╗ ╔══╗
  █  █  █  █       ┃  ┃ ┃  ┃        ║  ║ ║  ║
  █  █  █  █       ┃  ┃ ┃  ┃        ║  ║ ║  ║
  ████  ████       ┗━━┛ ┗━━┛        ╚══╝ ╚══╝

  minimal          classic           bold
  ┌──┐ ┌──┐         ██   ██          ████ ████
  │  │ │  │        █  █   █          ██ █  ██
  │  │ │  │        █  █   █          █  █  ███
  └──┘ └──┘        █  █   █          █ ██   ██
                    ██   ███         ████ ████
  ```

- **Themes** — `neon` (default), `amber`, `blue`, `mono`. Set the default with
  `flowclock config set theme amber`, or override per session with `start --theme blue`.

## The dashboard

**`flowclock`** (no subcommand) or **`flowclock dashboard`** (aliases `dash`,
`tui`) opens the dashboard — the **default entry point since v3**. It's a
flicker-free, navigable control center built on a small in-house raw-ANSI TUI
(alt-screen + double-buffer diff renderer): zero new dependencies, same instant
feel. Open directly on a specific view with `--view <name>` (e.g.
`flowclock dashboard --view help`).

### Views

The dashboard has **six views**, navigable by **`Tab`** or the number keys:

| Key | View | Contents |
| --- | ---- | -------- |
| `1` | **Session** | Live session hero (big counter, goal, target progress, break budget, ratio, controls footer) |
| `2` | **Overview** | Today's totals, flow-score gauge, daily goal, streaks, 7-day chart, achievements |
| `3` | **Sessions** | Scrollable history + per-session focus/break timeline |
| `4` | **Goals** | Per-goal rollups: focus time, count, hit/miss, target/budget |
| `5` | **Breaks** | Time by category (meal/exercise/walk/…) and focus-vs-rest balance |
| `6` | **Help** | Key bindings, view descriptions, and common workflows for newcomers |

### Session hero view (view 1)

The Session view hosts a **live, interactive session** inside the dashboard.
The big 7-segment counter is scaled "reserve-first" — it gets ample vertical
space before the surrounding metadata, so it never appears cramped:

```
 Flowclock   12:23:28   [1:Session]  2:Overview  3:Sessions  4:Goals  5:Breaks  6:Help
 ╔══════════════════════════════════════════════════════════╗
 ║  Deep work — StreamNet                                   ║
 ║                                                          ║
 ║    ████   █  ████  ████  ██ ████                         ║
 ║    █  █  ██     █     █ █ █    █                         ║
 ║    █  █   █   ███   ███  ████  ██                        ║
 ║    █  █   █  █        █ █    █   █                       ║
 ║    ████  ███ ████ ████      █ ████                       ║
 ║                                                          ║
 ║  goal · 42m/1h ███████░░░ 70%   break 06:00/20:00 · ratio 1:7.0   ║
 ╚══════════════════════════════════════════════════════════╝
       [p] pause · [b] break · [c] cat · [e] edit · [x] cancel · [q] stop
```

The control row lives in the **centered footer** below the panel (trimmed to the
essentials so it fits and centers in a small terminal — `[6] Help` lists them all).

Live session controls inside the dashboard:

| Key | Action |
| --- | ------ |
| `p` | Pause / resume |
| `b` | Start / end a break |
| `1`–`6` | Pick a quick break category (rest · meal · exercise · walk · distraction · other) |
| `c` | Open the break-category **picker** — **all** categories, incl. **coffee** and **sleep** |
| `e` | **Edit** the running session — goal, details, focus target, break budget (timer keeps counting) |
| `x` | **Cancel** the session (discard without saving — confirmed first) |
| `r` | Reset the session clock |
| `z` | Zen — hide metadata, big clock only |
| `Enter` | Hide / show the control footer |
| `q` | Stop & **save** the session (a summary shows, then the Session view) |

`q` saves, `x` discards. The full category set is `rest · meal · exercise ·
walk · distraction · other · coffee · sleep`; keys `1`–`6` stay bound to the
first six so the footer stays short, and **`[c]`** opens a picker for the rest.

### Starting a session — the in-dashboard form

You no longer need to drop to the shell to start a tailored session. On the idle
Session view, press **`s`**, **`n`**, or **`Enter`** (or run `start` from the `/`
palette) to open a centered form:

```
 ╔══════════════════ New session ══════════════════╗
 ║ › Goal          Deep work — StreamNet▏           ║
 ║   Details                                        ║
 ║   Target        1h                               ║
 ║   Break budget  20m                              ║
 ║                                                  ║
 ║   focus target — e.g. 1h, 90m, 25m (optional)    ║
 ║                                                  ║
 ║   [Tab] next · [Enter] start · [Esc] cancel      ║
 ╚══════════════════════════════════════════════════╝
```

`Tab` / `↑↓` move between fields, `Enter` starts the session inside the dashboard,
`Esc` cancels. Durations accept the same forms as the CLI (`1h30m`, `90m`, `25m`,
`45s`, or bare seconds); an invalid value is reported inline rather than starting
the session. Every field is optional — an empty form starts a plain session.

The shell entry point still works and behaves identically:

```bash
flowclock start --goal "Deep work — StreamNet" --target 1h --break-budget 20m
```

Every text field is a real editor: move with **← →**, **Home**/**End**, delete
around the cursor with **Backspace**/**Del**, and **paste** clipboard text
(multi-line pastes are flattened to one line). The same applies to the edit
overlays — `[e]` on the Sessions view (logged sessions) and `[e]` during a live
session (see below).

### Editing a running session — `[e]`

Sometimes you just want to **start the clock** before you've decided exactly what
you're doing. Begin a plain session, then press **`e`** at any point to open the
same form, pre-filled with the current goal, details, focus target and break
budget. Adjust anything, press **`Enter`**, and the changes apply **without
stopping the timer** — the session keeps counting and the crash-recovery journal
picks up the new metadata immediately. **`Esc`** discards the edit.

### Cancelling a session — `[x]` (discard) vs `[q]` (save)

For a throwaway or test session you don't want recorded, press **`x`**. A
confirm overlay appears (`[y]` / `[n]`); confirming discards the session
entirely — nothing is written and the recovery journal is cleared. Use **`q`**
when you want to stop **and save**.

### Crash recovery — resume an interrupted session

Hardware froze? Hard reset? While a session runs, FlowClock journals it to
`~/.local/share/flowclock/active-session.json` (on start, on each control
change, and on a ~5-second heartbeat). The next time you open the dashboard, an
orphaned journal triggers a resume prompt:

```
 ╔═══════════ Resume previous session? ════════════╗
 ║ A session was interrupted:                       ║
 ║   Deep work — StreamNet                          ║
 ║   details: CKIS Backup Session                   ║
 ║                                                  ║
 ║   focus  3h 12m                                  ║
 ║   break  0s                                      ║
 ║                                                  ║
 ║ [r] resume · [d] discard · [Esc] discard         ║
 ╚══════════════════════════════════════════════════╝
```

**`[r]`** (or `Enter`) rebuilds the session and keeps going; **`[d]`** / `Esc`
discards it. Recovery is conservative — it restores to the **last heartbeat**
and never counts the frozen gap as focus, so at most a few seconds are lost. A
clean stop (`q`) or cancel (`x`) removes the journal, so you are only ever
prompted after a real crash.

### Display style — `block` / `simple` / `outline` / `minimal` / `classic` / `bold` (cycle live)

The Session counter has six looks, all using the **same reserve-first scaling**
so they stay prominent without overshadowing the metadata:

- **`block`** (default) — solid 7-segment glyphs.
- **`simple`** — clean **heavy** line digits in box-drawing strokes (`┏━┓ ┃`);
  minimal but full hero size.
- **`outline`** — hollow **silhouette** of the block font rendered in
  **DOUBLE-LINE** box-drawing characters (`╔═╗ ║ ╚╝`): each digit is a
  distinctive double-walled nested-rectangle. Visually distinct from `minimal`
  at every scale (including scale 1 / minimized windows).
- **`minimal`** — clean **light** line digits in box-drawing strokes (`┌─┐ │`),
  airy `○` colon. Scales crisply at every size; lighter feel than `simple`.
- **`classic`** — solid **cornered "rounded-terminal" numerals** (a distinct,
  stylized glyph shape), sharing the exact 5-row × 4-col footprint of every other style.
- **`bold`** — solid **heavy-slab numerals** (a distinct, heavier glyph shape),
  sharing the exact 5-row × 4-col footprint of every other style.

Press **`d`** (or run `display` from the palette) to cycle
`block → simple → outline → minimal → classic → bold`, and **`t`** to cycle the
theme. Both choices are **saved to your config** as your new default — the same
as running `config set displayStyle classic` / `config set theme neon`. The
public default stays `block`; the rest are opt-in alternates. All six styles
share the same 5-row footprint — `classic`/`bold` are native distinct-shape
5-row fonts (cornered "rounded-terminal" classic / heavy-slab bold), so cycling
styles never changes the counter's size or covers the session goal.

### Live session controls

While a session runs, the **global footer** is the single source of control hints
(the panel no longer duplicates them):

- **`z`** — zen: hide the goal + focus/break metadata, leaving just the hero clock.
- **`Enter`** — hide/show the controls row to remove visual noise once memorised.
- **`p`** pause · **`b`** break · **`1`–`6`** category · **`r`** reset · **`q`** stop & save.

On the **Sessions** list, **`e`** opens an Edit-session overlay to change the
focus duration, break total, goal, or name for the selected session; the start
timestamp is immutable and the end + break timeline recompute automatically.
**`Supr`/`Delete`** opens a confirmation modal
(`[y] confirm · [n] cancel`) to delete the selected session from `sessions.json`.

### Command palette

Press **`/`** to open a transient, centered command-palette overlay. It is **not
a permanent bar** — it appears only when invoked and disappears when you press
**`Esc`** or select a command, keeping the dashboard chrome minimal.

### Navigation

```
[Tab] / [1–6]  switch view     [↑↓] / [j k]  scroll
[s] / [n]      new session     [Enter]        detail / start · hide controls (live)
[d]            display style   [t]            theme (both saved)
[z]            zen (live)      [Supr]         delete session (Sessions · confirm)
[e]            edit session (Sessions · focus/break/goal/name)
[/]            command palette [r]            refresh
[q] / [Esc]    quit / close overlay
```

The dashboard restores your terminal cleanly on exit — no artifacts.

### Agent snapshot (no TTY)

```bash
flowclock dashboard --json   # emits DashboardSnapshot, never launches the TUI
```

```
 Flowclock   12:23:28   [1:Overview]  2:Sessions  3:Goals  4:Breaks
 ┌─ Today ───────────────────────┐ ┌─ Flow ──────────────────────────────┐
 │ Focus     1h 45m   2 sessions │ │ Flow score   ████████░░░░  58/100   │
 │ Break        12m   ratio 8.8:1│ │ Daily goal   ████░░░░░░░░  44% (4h)  │
 │ Streak     1 day (best 1)     │ │ Achievements First Hour · Budget …   │
 └───────────────────────────────┘ └─────────────────────────────────────┘
 ┌─ Last 7 days ───────────────────────────────────────────────────────────┐
 │ Mon  Tue  Wed  Thu  Fri  Sat  Sun                                        │
 │  ▁    ▁    ▁    ▁    ▁    ▁    █    1h 45m today                          │
 └──────────────────────────────────────────────────────────────────────────┘
 [Tab] view · [↑↓] move · [Enter] detail · [r] refresh · [q] quit
```

## Gamification

`flowclock stats` turns your log into a scoreboard:

```
Today      1h 45m 00s  (2 sessions)
Best          55m 00s
Streak     1 day (best 1)

Flow Score   58/100
Daily Goal   44%  (1h 45m 00s of 4h 00m 00s)
Focus:Rest   8.8:1 today  (12m 00s break)
Achievements First Hour, Budget Master, Flow 4:1
```

- **Flow score (0–100)** — a composite of focus volume vs. your daily goal, a healthy
  focus:rest balance, and your streak.
- **Daily maximization** — focus time vs. `dailyFocusGoalS` (default 4h): how much of
  your target day you captured.
- **Streaks** — current and longest run of consecutive days with ≥1 session.
- **Achievements** — First Hour, Deep Diver (90m+ single focus), Budget Master, Flow
  4:1, Streak 7, Century.

### Weekly summary for your notes

```bash
flowclock summary --week            # this week
flowclock summary --week 2026-23    # a specific ISO week
```

```markdown
### Week 2026-W24

| Date | Sessions | Total | Best | Break | Ratio | Goal |
| ---- | -------- | ----- | ---- | ----- | ----- | ---- |
| 2026-06-09 | 2 | 1h 45m 00s | 55m 00s | 12m 00s | 8.8:1 | Ship v2 |
| **Total** | **2** | **1h 45m 00s** | | **12m 00s** | | |
```

## Agent-native by design

Every interactive flow has a non-interactive equivalent, so terminal AI agents
(Claude Code, Codex, Gemini CLI, and friends) can drive flowclock without a TTY:

```bash
flowclock log --duration 3000 --goal "Deep work" \
              --details "CKIS backup" --target 1h --break-budget 20m --json   # record a full session
flowclock edit <id> --focus 90m --details "renamed" --json   # fix a session that ran while you slept
flowclock dashboard --json | jq .data.game            # the whole snapshot, no TTY
flowclock stats --json | jq .data.game.flowScore      # compose with pipes
echo "$SESSION_JSON" | flowclock log --json           # accept session JSON on stdin
flowclock manifest --json                             # discover every command
flowclock mcp                                          # MCP server over stdio
```

- **`--json`** on every command, with a stable, versioned envelope.
- **`flowclock edit`** — the start timestamp is immutable; end and the break
  timeline recompute automatically from the new focus + break values.
- **`--yes`** skips prompts; **`--no-color`** / `NO_COLOR` for clean output.
- **Deterministic exit codes** (below) — the contract agents branch on.
- **No hidden TTY requirements:** non-TTY runs default to machine-friendly mode; the
  dashboard emits a JSON snapshot instead of launching the UI.
- **MCP server** exposes `flowclock_stats`, `flowclock_history`, `flowclock_log`,
  `flowclock_dashboard`, `flowclock_config_get/set`, and `flowclock_doctor`.

### Exit codes

| Code | Meaning                                                          |
| ---- | ---------------------------------------------------------------- |
| 0    | OK                                                               |
| 1    | Generic error                                                    |
| 2    | Invalid arguments / usage                                        |
| 3    | Configuration error                                              |
| 4    | Session data unreadable/corrupt                                  |
| 5    | Interactive flow required but no TTY (use `--duration`/`--json`) |
| 6    | A `doctor` check failed                                          |

## Configuration

Stored at `config.json` in your config dir (`flowclock config path`). Keys:

| Key | Default | Meaning |
| --- | --- | --- |
| `theme` | `neon` | `neon` · `amber` · `blue` · `mono` |
| `displayStyle` | `block` | Counter look: `block` solid (default), `simple` heavy line digits, `outline` hollow silhouette in double-line chars (`╔═╗`) distinct from `minimal`, `minimal` light line digits, `classic` cornered/rounded solid numerals (distinct shape), `bold` heavy-slab solid numerals (distinct shape) — all share the exact 5-row footprint; cycle live with `d` |
| `showControls` | `true` | show the controls footer (`--zen` overrides) |
| `dailyFocusGoalS` | `14400` | daily focus goal in seconds (drives maximization %) |
| `keybindings.{pause,break,category,reset,quit}` | `p` `b` `c` `r` `q` | in-session keys |
| `sessionsPath` | `null` | override `sessions.json` location |
| `apiEndpoint` | `null` | optional JSON push endpoint (roadmap) |

Override locations with `FLOWCLOCK_CONFIG_DIR` / `FLOWCLOCK_DATA_DIR`. Sessions are
appended silently to `sessions.json` (atomic writes, corrupt-file recovery). Old
`v1`/`v2` files load unchanged — legacy pauses are migrated to categorized breaks
on read.

## Data model

A session records **active focus seconds** (`durationS`) plus categorized
**breaks** (each with `category` ∈ `rest·meal·exercise·walk·distraction·other·coffee·sleep`),
the total `breakS`, and the optional `focusTargetS` / `breakBudgetS` you set. The
on-disk schema is **v3**; migrations are non-destructive.

## Roadmap

| Version | Focus |
| ------- | ----- |
| **v0.1.0** ✅ | Core HUD, silent logging, `stats`/`history`/`config`/`doctor`, agent-native layer, MCP server |
| **v1.0.0** ✅ | Goals mode, daily streaks, theme override + `--big`, weekly export, shell completions, schema v2 |
| **v2.0.0** ✅ | Flowtime break model (categories), targets + break budgets, proportional breaks, gamification (flow score/achievements), interactive TUI dashboard, visible controls + `--zen`, schema v3 |
| **v3.0.0** ✅ | Dashboard as default command; Session hero view (big balanced counter, live controls); Help view; `/` command palette; `start --bare`; `dashboard --view`; live theme switching; reserve-first counter scaling |
| **v3.1.0** ✅ | In-dashboard new-session form (goal/name/target/break); live + persisted display-style (`d`) and theme (`t`) toggles; scaled minimal `simple` style (shares `block`'s scaling) |
| **v3.2.0** ✅ | `simple` reworked into a clean line font; `outline` added as a third selectable style; display-style toggle fixed on small/tiled windows |
| **v3.3.0** ✅ | `classic` + `bold` terminal-style counter fonts; `outline` rewritten as clean line-art (fixes small/medium rendering); centered session layout; `z` zen + `Enter` hide-controls; delete a session from the dashboard (confirm modal); deduped controls footer |
| **v3.3.1** ✅ | `outline` redrawn as a light seven-segment font (no more garbling at large scale); `classic`/`bold` degrade gracefully (drop goal line → block font) instead of collapsing to a text clock in a minimized window with metadata |
| **v3.4.0** ✅ | restored the original silhouette `outline` style (hollow double-wall nested-rectangle); added `minimal` (light seven-segment line font); uniform counter scaling so `classic`/`bold` no longer tower over the 5-row fonts in minimized/zen windows |
| **v3.4.1** ✅ | `outline` double-line box-drawing chars (`╔═╗`) — distinct from `minimal` at every scale; uniform `classic`/`bold` footprint — height capped to 5-row reference, degrades to `block` in short windows |
| **v3.5.0** ✅ | `classic`/`bold` redesigned as 5-row shade weights (`▒`/`▓`) for exact footprint parity with all styles — no more towering, goal covering, or silent fallback to `block` |
| **v3.5.1** ✅ | `classic` lightened to `░` shade so block `█` / classic `░` / bold `▓` read as three distinct surfaces while keeping exact 5-row footprint parity |
| **v3.6.0** ✅ | `classic`/`bold` redesigned as native 5-row fonts with distinct glyph shapes (cornered `classic` / heavy-slab `bold`, both solid) — replaces the v3.5.x shade-fill approach so the three solid styles read as clearly distinct while keeping exact footprint parity |
| **v3.7.0** ✅ | Session editing — in-dashboard `[e]` overlay (view 3 · Sessions) and `flowclock edit <id>` CLI; editable fields: focus, break total, goal, details; start immutable; end + break timeline recompute automatically |
| **v3.8.0** ✅ | Crash recovery (resume an interrupted session); `[x]` cancel-without-saving; `coffee` + `sleep` break categories with a picker; full line editors (cursor + paste) in every text field; "Name" → "Details" (CLI `--details`, `--name`/`--label` kept as aliases) |
| **v3.9.0** ✅ | Edit a **running** session with `[e]` (goal/details/target/budget, timer keeps counting); break-category picker moved to **`[c]`** (was `[m] more`); centered, compact session footer; header reads **Flowclock** (dropped the "Dashboard" suffix) |
| **next** | `flowclock sync` — push `sessions.json` to a self-hosted/cloud endpoint; recurring goals; dashboard filters |
| **later** | Per-goal analytics deep-dives, calendar heatmap, Homebrew tap |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: branch from `main`, add
tests, keep the HUD instant and dependency-free, and make sure
`npm run build && npm test && npm run lint && npm run typecheck` all pass before
opening a PR.

## License

flowclock-cli is **dual-licensed — this is final**:

- **Open source:** [GNU AGPL-3.0](LICENSE) (or later). Free for everyone; the code
  stays open. The AGPL's network clause keeps hosted forks open too.
- **Commercial:** [LICENSE-COMMERCIAL](LICENSE-COMMERCIAL) — for companies that want
  to embed or resell flowclock without AGPL obligations.

MIT/Apache are **deliberately not used**: they would let a company resell the work
without a commercial agreement. The dual model keeps it free for the public while
reserving commercial rights for the author.

Part of the **Korvex** agent-native developer-tool suite, alongside `recmp3-cli`.
