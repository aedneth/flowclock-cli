---
type: project-overview
project: flowclock-cli
status: planning
created: 2026-05-11
modified: 2026-05-11
tags: [project, open-source, cli, productivity, flowtime, terminal, typescript, nodejs]
related:
  - "[[03-knowledge/maps-of-content/Public-Repos-Master-Strategy]]"
  - "[[04-resources/tools/Flowtime HUD Pop OS Gnome]]"
  - "[[02-projects/recmp3-cli/_overview]]"
  - "[[02-projects/korvex/_overview]]"
---

# flowclock-cli — Overview

## Status
Planning — Bash prototype (`~/flowtime.sh`) is production-proven, daily-use. CLI rewrite not yet started.

## What it is
Cross-platform Flowtime count-up timer built as a global CLI command (`flowclock`). Evolved from a single-file Bash script + GNOME Terminal "Pop Clock" profile. Targets developer terminals — no GUI, no Electron, no Pomodoro.

Key differentiator: Flowtime, not Pomodoro. You decide when to stop. The tool counts up, logs everything, gets out of the way.

## Core design principles
- **HUD, not an app.** Single line: `HH:MM:SS` centered on screen. No chrome.
- **Invisible controls.** `p` pause · `r` reset · `q` quit. Nothing printed.
- **Terminal-first.** Works in iTerm2, Kitty, Alacritty, Windows Terminal, any GNOME profile.
- **Log everything silently.** Session ends → auto-saved to `~/.config/flowclock/sessions.json`. No prompts.
- **Stats on demand.** `flowclock stats` only. Timer view is distraction-free.

## Commands
```bash
flowclock            # Start session (HUD mode, default)
flowclock start      # Explicit start
flowclock stats      # Today's total, session count, best, average + weekly summary
flowclock history    # Session history table (most recent first)
flowclock config     # Theme, keybindings, log path, API endpoint
flowclock doctor     # Verify installation (terminal capabilities, write access, Node version)
```

**In-session controls:** `p` pause/resume · `r` reset · `q` or `Ctrl+C` stop + log

## Technical architecture
| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 20 + TypeScript 5.5 | Same ecosystem as recmp3-cli; Eduardo has Ink expertise |
| TUI | Ink v5 | Proven for HUD-style rendering; handles terminal resize |
| CLI parsing | Commander v13 | Already in recmp3-cli stack |
| Bundler | tsup | Zero-config, ESM output |
| Config paths | XDG (`~/.config/flowclock/`) | Linux-standard; macOS fallback `~/Library/Application Support/` |
| Session storage | `sessions.json` (append-only array) | Simple, human-readable, portable |
| Distribution | npm global install (`npm i -g flowclock-cli`) | Primary; Homebrew tap later |

**Alternative under consideration:** Go — single static binary, no Node.js dep, easier cross-platform distribution. Decision blocked on whether dual-ecosystem maintenance cost is worth it.

## Features backlog
- Color themes: neon green (default), amber, blue, monochrome
- ASCII block-char time display (optional `--big` flag)
- Optional JSON API push (custom analytics endpoint, configurable)
- `flowclock summary --week` markdown export (for vault log)
- Shell completion (bash, zsh, fish)
- Integration hint: RecMP3 session IDs ↔ FlowClock session timestamps (correlate audio + time)

## Open decisions
1. **Node.js vs Go.** Node = faster ship, same stack. Go = single binary, no runtime dep. Leaning Node to ship fast, migrate later.
2. **Ink vs raw `tput`.** Ink adds ~15ms startup overhead. Acceptable? Bash script was instant. May need a lightweight alternative (blessed, terminal-kit).
3. **sessions.json schema.** Needs: `id`, `start`, `end`, `duration_s`, `pauses[]`, `notes?`. Finalize before v0.1.0.
4. **License enforcement.** AGPL-3.0 + Dual Commercial — same model as recmp3-cli. Need to decide on commercial tier pricing before public launch.
5. **npm package name.** `flowclock-cli` (package) → `flowclock` (binary). Confirm availability before init.

## Key files (placeholders — repo not yet created)
```
flowclock-cli/
  src/
    commands/start.tsx     # Ink TUI timer component
    commands/stats.ts      # Stats aggregation + display
    commands/history.ts    # Session table
    commands/config.ts     # Config read/write
    commands/doctor.ts     # Health checks
    lib/session.ts         # Session logging (read/write sessions.json)
    lib/timer.ts           # Core count-up logic (seconds, pause state)
    lib/config.ts          # XDG path resolution, defaults
  package.json
  tsconfig.json
  LICENSE                  # AGPL-3.0
```

## Blockers
- None hard. Bash prototype validates all UX decisions.
- Ink v5 startup latency TBD — needs benchmark before committing.
- npm package name availability check pending.

## Connection to public repo strategy
Part of Eduardo's developer tool suite alongside `recmp3-cli`. Both are AGPL-3.0 + commercial dual-license, targeting the same audience (developer productivity, terminal-first). FlowClock is the time-tracking layer; RecMP3 is the audio-capture layer — they compose naturally. Both feed the public repo strategy: open-source credibility + Korvex brand signal.

See [[03-knowledge/maps-of-content/Public-Repos-Master-Strategy]] for positioning and launch sequencing.
