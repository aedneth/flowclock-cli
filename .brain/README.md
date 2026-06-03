---
type: brain-readme
project: korvex-web
created: 2026-05-03
modified: 2026-05-03
tags: [brain, ckis-bridge]
---

# `.brain/` — Per-project second brain

Project-level memory layer for Claude Code sessions. Bridges this repo to the
global CKIS vault at `~/Documents/Second Brain/`.

## What lives here

| Path             | Purpose                                          | Committed?      |
| ---------------- | ------------------------------------------------ | --------------- |
| `_CONTEXT.md`    | Auto-assembled session start context             | No (regenerable) |
| `decisions/`     | Decision logs (CKIS format — see skill card)     | **Yes**         |
| `bugs/`          | Bug → fix narratives                             | **Yes**         |
| `sessions/`      | Per-session summaries written by Stop hook       | No (personal)   |
| `graph/`         | Graphify output (`graph.json`, `GRAPH_REPORT.md`, vault/) | No (regenerable) |
| `scripts/`       | Hooks + assembler scripts                        | **Yes**         |
| `config.sh`      | Per-project config (CKIS paths, project slug)    | **Yes**         |

## How it works

1. **SessionStart hook** runs `scripts/assemble-context.sh`:
   - Concatenates latest 3 session summaries + open decisions + active bugs
   - Pulls god-nodes section from `graph/GRAPH_REPORT.md` if Graphify has run
   - Adds pointers to CKIS `_MEMORY.md` and project `_overview.md`
   - Writes the result to `_CONTEXT.md` and emits it as session context.

2. **Stop hook** runs `scripts/log-session.sh`:
   - Records git diff, commits, branch, duration vs. session start.
   - Creates `sessions/YYYY-MM-DD-HHMM-session.md` with a "Summary" section to fill in.

3. **Graphify** rebuilds `graph/` automatically on every git commit
   (via `graphify hook install`) and is symlinked from the CKIS vault under
   `02-projects/korvex/graph/` so the graph view shows up alongside the
   curated overview.

## Bridge to CKIS

- Strategic / cross-project state → `~/Documents/Second Brain/00-inbox/_MEMORY.md`
- Project overview (curated) → `~/Documents/Second Brain/02-projects/korvex/_overview.md`
- Architecture spec → `~/Documents/Second Brain/03-knowledge/permanent-notes/per-project-second-brain.md`

## See also

- `00-system/ckis/06-decision-execution-and-review-protocol.md` — decision-log format
- `.claude/skills/ckis-decision-log/` — skill that writes here
