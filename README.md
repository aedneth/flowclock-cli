<div align="center">

# flowclock

**A Flowtime count-up terminal timer — a HUD, not a Pomodoro.**

One centered `HH:MM:SS` line. Invisible controls. Silent session logging.
Built to be driven by **humans and AI agents** alike — like `gh` and `vercel`.

[![CI](https://github.com/aedneth/flowclock-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/aedneth/flowclock-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/flowclock-cli.svg)](https://www.npmjs.com/package/flowclock-cli)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commercial-blue.svg)](#license)

</div>

---

## Why Flowtime, not Pomodoro

Pomodoro interrupts you every 25 minutes. **Flowtime counts up and gets out of
the way** — you decide when to stop. flowclock shows a single centered clock,
logs every session silently, and never puts a dashboard in front of your focus.

It started as a production-proven Bash HUD used daily; this is the
cross-platform, agent-native rewrite that preserves that exact minimalist UX.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                                                 │
│                    00:42:17                     │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

That's the whole screen. `p` pauses, `r` resets, `q` stops — all invisible.
No clock face, no progress bar, no status text, no visible hint. Nothing competing for your attention.

## Install

```bash
npm install -g flowclock-cli
```

Requires **Node.js 20+**. Works on Linux, macOS, and Windows (iTerm2, Kitty,
Alacritty, Windows Terminal, GNOME Terminal, …).

## Use

```bash
flowclock                 # start the HUD (default command)
flowclock start           # the same, explicitly
flowclock start --goal "Deep work on StreamNet"   # name your intention
flowclock start --big     # big 7-segment display (compact fallback if narrow)
flowclock stats           # today total, count, best, average, streak + last 7 days
flowclock history         # session history, newest first
flowclock goals           # your goals, with met/missed tallies
flowclock summary --week  # markdown table of this week (paste into notes)
flowclock config list     # view configuration
flowclock completion zsh  # print a shell completion script (bash|zsh|fish)
flowclock doctor          # verify your installation
```

**In-session controls (invisible):** `p` pause/resume · `r` reset ·
`q` or `Ctrl-C` stop & log.

Sessions are appended silently to `sessions.json` under your platform's data
directory (XDG on Linux). Nothing is ever printed over the timer.

## Goals, streaks & themes

Name what you're sitting down to do and flowclock keeps score — quietly.

```bash
flowclock start --goal "Write the v1 launch post"
# … focus … then press q. If you set a goal, a 3-second y/n prompt asks whether
# you met it (skip = neutral, it never blocks your quit).
```

- **`flowclock goals`** rolls those up: time spent and how often you hit each one.
- **`flowclock stats`** shows your **current and longest daily streak** — one
  session a day keeps it alive (today or yesterday counts as current).
- **Themes:** `neon` (default), `amber`, `blue`, `mono`. Set the default with
  `flowclock config set theme amber`, or override per session with
  `flowclock start --theme blue`.
- **`flowclock start --big`** renders the clock in a block font:

```
████   █    ████ ████   █  █ ████
█  █  ██  █    █    █ █ █  █ █
█  █   █    ████  ███   ████ ████
█  █   █  █ █       █ █    █    █
████  ███   ████ ████      █ ████
```

On a terminal narrower than 60 columns it falls back to the compact HUD —
never partial garbage.

### Weekly summary for your notes

```bash
flowclock summary --week            # this week
flowclock summary --week 2026-23    # a specific ISO week
```

```markdown
### Week 2026-W23

| Date | Sessions | Total | Best | Goal |
| ---- | -------- | ----- | ---- | ---- |
| 2026-06-03 | 3 | 2h 10m 00s | 1h 05m 00s | Write the v1 launch post |
| **Total** | **3** | **2h 10m 00s** | | |
```

## Agent-native by design

Every interactive flow has a non-interactive equivalent, so terminal AI agents
(Claude Code, Codex, Gemini CLI, Hermes, OpenClaw, OpenCode, DeepSeek) can drive
flowclock without a TTY:

```bash
flowclock log --duration 1500 --label "deep work" --json   # record a session
flowclock stats --json | jq .data.todayTotalS              # compose with pipes
echo "$SESSION_JSON" | flowclock log --json                # accept JSON on stdin
flowclock manifest --json                                  # discover all commands
flowclock mcp                                              # MCP server over stdio
```

- **`--json`** on every command, with a stable, versioned envelope.
- **`--yes`** skips all prompts; **`--no-color`** / `NO_COLOR` for clean output.
- **Deterministic exit codes** (see below) — the contract agents branch on.
- **No hidden TTY requirements**: non-TTY runs default to machine-friendly mode.
- **MCP server** exposes `flowclock_stats`, `flowclock_history`, `flowclock_log`,
  `flowclock_config_get/set`, and `flowclock_doctor` as callable tools.

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
`theme` (`neon`·`amber`·`blue`·`mono`), `keybindings.{pause,reset,quit}`,
`sessionsPath`, `apiEndpoint`, `bigFont`. Override locations with
`FLOWCLOCK_CONFIG_DIR` / `FLOWCLOCK_DATA_DIR`.

## Roadmap

| Version | Focus |
| ------- | ----- |
| **v0.1.0** ✅ | Core HUD, silent logging, `stats`/`history`/`config`/`doctor`, agent-native layer, MCP server, AGPL-3.0 + commercial |
| **v1.0.0** ✅ | Goals mode, daily streaks, theme override + `--big` display, weekly markdown export, shell completions, recmp3 correlation, schema v2 |
| **v1.1.0** | `flowclock sync` — push `sessions.json` to a self-hosted or cloud endpoint; terminal GIF demo in README |
| **later** | Recurring/scheduled goals, richer per-goal analytics, Homebrew tap |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: branch from `main`, add
tests, keep the HUD minimal, and make sure `npm run build && npm test && npm run
lint && npm run typecheck` all pass before opening a PR.

## License

flowclock-cli is **dual-licensed — this is final**:

- **Open source:** [GNU AGPL-3.0](LICENSE) (or later). Free for everyone; the
  code stays open. The AGPL's network clause keeps hosted forks open too.
- **Commercial:** [LICENSE-COMMERCIAL](LICENSE-COMMERCIAL) — for companies that
  want to embed or resell flowclock without AGPL obligations.

MIT/Apache are **deliberately not used**: they would let a company resell the
work without a commercial agreement. The dual model keeps it free for the public
while reserving commercial rights for the author.

Part of the **Korvex** agent-native developer-tool suite, alongside `recmp3-cli`.
