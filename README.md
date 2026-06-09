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
flowclock                                    # start a focus session (the HUD)
flowclock start --goal "Ship v2" \
                --target 1h --break-budget 20m   # play the focus/budget game
flowclock dashboard                          # open the interactive TUI dashboard
flowclock stats                              # flow score, ratio, streak, achievements
```

## The HUD

`flowclock` (or `flowclock start`) opens a clean, centered clock with a discreet
controls footer:

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

- **`displayStyle`** — `simple` (default, the centered clock) or `block`
  (7-segment ASCII). Override per session with `start --big`.

  ```
  ████   █    ████ ████   █  █ ████
  █  █  ██  █    █    █ █ █  █ █
  █  █   █    ████  ███   ████ ████
  █  █   █  █ █       █ █    █    █
  ████  ███   ████ ████      █ ████
  ```

- **Themes** — `neon` (default), `amber`, `blue`, `mono`. Set the default with
  `flowclock config set theme amber`, or override per session with `start --theme blue`.

## The dashboard

**`flowclock dashboard`** (aliases `dash`, `tui`) opens a flicker-free, navigable
control center — a program running *inside* your terminal, no file-spelunking
required. It's built on a small in-house raw-ANSI TUI (alt-screen + double-buffer
diff renderer): zero new dependencies, same instant feel.

```
 Flowclock Dashboard   12:23:28   [1:Overview]  2:Sessions  3:Goals  4:Breaks
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

- **Overview** — today's focus/break totals, focus:rest ratio, flow-score gauge,
  daily-maximization bar, streaks, last-7-days chart, latest achievements.
- **Sessions** — scrollable history; press **`Enter`** for a per-session **timeline**
  of focus and break intervals with their categories and durations.
- **Goals** — per-goal rollups: focus time, break time, count, hit/miss, target/budget.
- **Breaks** — time by category (meal/exercise/walk/…) and focus-vs-rest balance.

Navigate with **`Tab`** / **`1`–`4`** (views), **`↑↓`** / **`j` `k`** (move),
**`Enter`** (detail), **`r`** (refresh), **`q`** / **`Esc`** (quit). It restores your
terminal cleanly on exit — no artifacts.

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
              --target 1h --break-budget 20m --json   # record a full session
flowclock dashboard --json | jq .data.game            # the whole snapshot, no TTY
flowclock stats --json | jq .data.game.flowScore      # compose with pipes
echo "$SESSION_JSON" | flowclock log --json           # accept session JSON on stdin
flowclock manifest --json                             # discover every command
flowclock mcp                                          # MCP server over stdio
```

- **`--json`** on every command, with a stable, versioned envelope.
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
| `displayStyle` | `simple` | `simple` clock or `block` 7-segment |
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
**breaks** (each with `category` ∈ `rest·meal·exercise·walk·distraction·other`),
the total `breakS`, and the optional `focusTargetS` / `breakBudgetS` you set. The
on-disk schema is **v3**; migrations are non-destructive.

## Roadmap

| Version | Focus |
| ------- | ----- |
| **v0.1.0** ✅ | Core HUD, silent logging, `stats`/`history`/`config`/`doctor`, agent-native layer, MCP server |
| **v1.0.0** ✅ | Goals mode, daily streaks, theme override + `--big`, weekly export, shell completions, schema v2 |
| **v2.0.0** ✅ | Flowtime break model (categories), targets + break budgets, proportional breaks, gamification (flow score/achievements), interactive TUI dashboard, visible controls + `--zen`, schema v3 |
| **v2.1.0** | `flowclock sync` — push `sessions.json` to a self-hosted/cloud endpoint; recurring goals; dashboard filters |
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
