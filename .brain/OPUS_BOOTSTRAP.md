---
type: opus-bootstrap
project: flowclock-cli
created: 2026-06-03
status: active
---

# OPUS ORCHESTRATOR BOOTSTRAP — flowclock-cli

> Paste this as your first message after `claude --resume <session-id>` in the flowclock-cli tab.
> Model: `claude-opus-4-8` (set via `/model claude-opus-4-8` after resume).

---

## YOUR ROLE

You are the **Opus 4.8 orchestrator** for flowclock-cli. Your mission is to take this project from **v0.1.0** to a polished, published **v1.0.0** — the definitive Flowtime productivity timer for developer terminals.

You will:
1. Load full codebase context (brain layer + graphify knowledge graph)
2. Produce the ultraplan — complete, prioritized feature roadmap to v1.0.0
3. Break into atomic sprint tasks — each independently executable and verifiable
4. Orchestrate Sonnet worker agents to execute each task
5. Audit all builds — catch regressions, security issues, quality gaps
6. Orchestrate fix workers for all findings
7. When all quality gates pass: commit, tag v1.0.0, push, trigger npm publish

---

## STEP 1 — LOAD CONTEXT FIRST

```bash
cat .brain/_CONTEXT.md
cat graphify-out/GRAPH_REPORT.md
cat ~/Documents/Second\ Brain/02-projects/flowclock-cli/_overview.md
cat package.json
find src/ -name "*.ts" | sort
```

Key facts (ground truth — do not re-derive):
- **Current version:** v0.1.0
- **Stack:** Node.js 20 ESM + TypeScript 5.5 + tsup + Commander v13 + **raw ANSI** (NOT Ink — dropped for instant start)
- **Core god nodes:** `printJson()` (17 edges), `jsonSuccess()` (16), `fail()` (13), `sessionsPathFor()` (13), `Timer` (11), `readSessions()` (11), `runStats()` (9), `appendSession()` (9)
- **Agent-native:** Already implemented — `printJson()` + `jsonSuccess()` provide JSON output mode; `--json` flag works
- **Architecture decisions FINAL:** raw ANSI (not Ink), Node.js (not Go), sessions.json (append-only), `flowclock-cli` npm package name
- **Tests:** 10 test files, CI green on ubuntu/macos/windows × node 20/22
- **License:** AGPL-3.0 + Dual Commercial (FINAL)
- **Blocker:** `NPM_TOKEN` secret not set on GitHub → npm publish blocked (development unblocked)

---

## STEP 2 — ULTRAPLAN TARGET (v1.0.0)

### A. Goals Mode
- `flowclock start --goal "Deep work on StreamNet"` — attach a label/goal to a session
- `flowclock goals` — list configured recurring goals (daily focus areas)
- Sessions tagged with goals appear in `stats` and `history` with goal label
- Goal completion: when user quits, optionally mark goal as hit/missed (keyboard prompt, 3-second timeout, skip = neutral)
- Schema: add `goal?: string` + `goalMet?: boolean` to session schema (versioned migration from schemaVersion 1 → 2)

### B. Streaks
- Track consecutive days with at least one session logged
- `flowclock stats` adds: current streak, longest streak, last session date
- `flowclock stats --json` returns streak fields for scripting
- Streak resets at midnight local time (use XDG config timezone or system timezone)

### C. Color Themes
- `flowclock config --theme <name>` — supported themes: `green` (default), `amber`, `blue`, `mono`
- Theme affects: timer digit color + pause indicator
- Implementation: ANSI escape codes in raw ANSI layer — no external dep
- `flowclock doctor` verifies terminal color support (256-color vs basic 8)

### D. ASCII Big Display (`--big` flag)
- `flowclock start --big` — renders time in ASCII block characters (7-segment style)
- Fallback: if terminal width < 60, silently fall back to compact HUD
- Font: implement a minimal 7-segment ASCII font for digits 0-9 and `:`

### E. Shell Completions
- `flowclock completion bash` / `completion zsh` / `completion fish` — print completion script
- README install instructions for each shell
- Auto-detect shell in `flowclock doctor` and suggest completion install

### F. Weekly Markdown Export
- `flowclock summary --week [YYYY-WW]` — output markdown table of sessions for that week
- Useful for pasting into Obsidian daily/weekly notes
- Default: current week. Format: `| Date | Sessions | Total | Best | Goal |`

### G. npm Publish Pipeline
- Add `NPM_TOKEN` setup instructions to `CONTRIBUTING.md`
- Verify release GitHub Action triggers correctly on `v*` tag push
- `npm publish --dry-run` must pass

### H. Terminal GIF Demo
- Generate `demo.gif` using `asciinema rec` + `agg` (asciinema gif generator) or a static SVG terminal recording
- Embed in README as the hero element above the fold
- Show: `flowclock start` → HUD running → pause → resume → quit → stats output

### I. Integration Hint (RecMP3 ↔ FlowClock)
- Log `recmp3SessionId?` as an optional session field (null if not running recmp3 at the same time)
- Document the correlation use case in README
- This does NOT require recmp3-cli as a dependency — it's a naming convention only

---

## STEP 3 — SPRINT ATOMIZATION RULES

1. **One task = one atomic deliverable** — independently buildable, testable, committable
2. **Done criterion is a specific command or test assertion** — not "it looks good"
3. **Schema migrations are their own task** — separate from feature code
4. **No task breaks the existing HUD** — `flowclock` (bare) must always start the timer correctly
5. **`--json` must work on every command that touches data** — verify after every feature task
6. **Label tasks:** `[CORE]`, `[TEST]`, `[INFRA]`, `[DOCS]`

Example atomic task format:
```
TASK-03 [CORE]: Implement sessions.json schemaVersion 2 migration (goal fields)
  Files: src/lib/session.ts (add goal fields + migration logic), src/lib/session.test.ts
  Done: `npm test` passes; `readSessions()` correctly reads both v1 and v2 session files;
        `appendSession({ goal: 'Deep work' })` writes goal field to sessions.json
  Depends: none (foundation task — must come before Goals Mode UI)
```

---

## STEP 4 — WORKER ORCHESTRATION PROTOCOL

Spawn Sonnet workers using the Agent tool.

**Worker briefing template:**
```
You are a Sonnet execution agent for flowclock-cli — a raw-ANSI terminal Flowtime timer.

IMPORTANT ARCHITECTURE FACTS:
- Raw ANSI (no Ink, no blessed) — terminal output via process.stdout.write() + ANSI codes
- printJson() and jsonSuccess() are the agent-native output layer — use them, don't bypass
- sessions.json is append-only — never rewrite the whole file, use appendSession()
- All config paths via sessionsPathFor() / XDG — never hardcode ~/.config paths

TASK: [exact task spec]
CONTEXT: [relevant god nodes from graph]
CONSTRAINTS:
- Read before edit
- Immediately runnable (no TODOs, all imports present)
- npm run build passes, npm test passes
- Do NOT add features beyond task scope
- Do NOT modify ANSI rendering logic unless the task specifically targets it
- Do NOT commit — leave for orchestrator review

Report back: files changed + commands to verify done criterion.
```

---

## STEP 5 — AUDIT PROTOCOL

```bash
npm run build && npm test
npm run lint 2>/dev/null || npx eslint src/ 2>/dev/null || true
npx tsc --noEmit
npm audit --audit-level=moderate
```

**Audit checklist:**
- [ ] `flowclock` (bare) starts HUD instantly (< 150ms cold start — benchmark if regression suspected)
- [ ] `flowclock --json` flag works on: start (headless session log), stats, history, summary
- [ ] sessions.json schemaVersion migration is non-destructive (old sessions still readable)
- [ ] No hardcoded `~/.config/flowclock/` paths — all via `sessionsPathFor()`
- [ ] `fail()` is called with a non-zero exit code on all error paths
- [ ] `flowclock doctor` passes all checks (node version, write access, TTY capability, color support)
- [ ] Streak logic handles edge case: no sessions ever logged (first run)
- [ ] `--big` flag falls back gracefully on narrow terminals without crash

---

## STEP 6 — COMPLETION CRITERIA + COMMIT

- [ ] `npm run build` → exit 0
- [ ] `npm test` → all tests pass (including new goal/streak/theme tests)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 errors
- [ ] `npm audit` → no moderate/high vulnerabilities
- [ ] Cold start benchmark: `time flowclock --version` < 150ms
- [ ] `npm publish --dry-run` → exits cleanly
- [ ] `flowclock doctor` → all checks pass

When all pass:
```bash
git add [specific files]
git commit -m "feat: flowclock-cli v1.0.0 — Goals mode, streaks, themes, ASCII big, shell completions"
git tag v1.0.0
git push origin main --tags
# npm publish triggered automatically by release workflow on tag push
```

---

## STEP 7 — PERSONAL GUIDE (after v1.0.0 is pushed)

This step runs **only after Step 6 is fully complete** — v1.0.0 tagged, pushed, and npm published.

Write Eduardo's personal reference guide to:
`~/Documents/Second Brain/02-projects/flowclock-cli/personal-guide.md`

**What this IS:** Eduardo's personal manual — how he actually uses FlowClock in his daily work rhythm, written in plain language with real examples.
**What this is NOT:** developer documentation or a README for strangers.

### Guide structure:

```
---
type: guide
subtype: personal-tool-reference
project: flowclock-cli
created: <today>
modified: <today>
tags: [guide, cli, personal-reference, flowclock, productividad, flowtime]
related:
  - "[[02-projects/flowclock-cli/_overview]]"
---

# flowclock — Mi Guía Personal
```

**Section 1 — ¿Qué es esto y por qué existe?**
Plain-language: Flowtime vs Pomodoro — why Eduardo chose Flowtime for how he actually works. What was the old setup (GNOME Terminal "Pop Clock" profile + bash script) and why it broke. What problem does this solve TODAY.

**Section 2 — Cómo lo tengo instalado**
`npm i -g flowclock-cli` → `flowclock` available globally. Where sessions log (`~/.config/flowclock/sessions.json`). The config file and what Eduardo has customized (theme, keybindings).

**Section 3 — Todos los comandos con ejemplos reales**
Every command Eduardo actually types:
- `flowclock` / `flowclock start` — starts the HUD. What it looks like. Keys: `p` pause, `r` reset, `q` quit.
- `flowclock start --goal "Trabajar en Korvex CRM"` — labeled session
- `flowclock stats` — what the output looks like (today's total, streak, best session)
- `flowclock history` — how to read the session table
- `flowclock summary --week` — markdown export for Obsidian weekly notes
- `flowclock config` — what Eduardo has set
- `flowclock doctor` — what a clean output looks like
- `flowclock --json` — when Eduardo pipes output to scripts

**Section 4 — Cómo lo uso en mi rutina**
Real workflows:
1. Antes de trabajar: `flowclock start --goal "Deep work — [tarea]"` → trabaja hasta terminar o cansarse → `q` → automáticamente guardado
2. Revisión diaria: `flowclock stats` al final del día → ¿cuánto tiempo realmente trabajé?
3. Weekly review: `flowclock summary --week` → pegar en el log semanal de Obsidian
4. Streak tracking: primer comando del día para no romper la racha

**Section 5 — Integración con las otras herramientas**
- flowclock + recmp3: cómo correlacionar sesiones de audio con sesiones de tiempo (via timestamps)
- flowclock como "guard" antes de cambiar de contexto: si la sesión fue corta, revisar por qué

**Section 6 — Lo que aprendí usándolo**
- Por qué raw ANSI y no Ink: la diferencia en velocidad de arranque que se siente
- Por qué Flowtime funciona mejor que Pomodoro para Eduardo (sistemas, no timers fijos)
- El archivo `sessions.json` es legible — Eduardo puede abrirlo y entenderlo

**Section 7 — Referencia rápida**
Cheat sheet: todos los comandos en una tabla con descripción de una línea.

### After writing the guide:
1. Write the file to the exact CKIS path above
2. Add `[[personal-guide]]` wikilink to `02-projects/flowclock-cli/_overview.md`
3. Update `_overview.md`'s `modified:` to today

---

## CKIS INTEGRATION REMINDER

- `.brain/decisions/` — write ADR files for: Goals schema choice, streak reset logic, ASCII font choice
- Every commit triggers CKIS graph-report sync automatically
- `.brain/scripts/log-session.sh` runs at Stop — session logged to Dev Brain

Begin by executing Step 1 (Load Context) now.
