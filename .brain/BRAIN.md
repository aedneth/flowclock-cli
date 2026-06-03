# `.brain/` — agent workflow rules

This repo has a per-project second brain at `.brain/`. Hooks in
`.claude/settings.json` drive it automatically. Your job during a session:
keep the brain useful for the *next* session.

## At session start (already automatic)

The `SessionStart` hook runs `.brain/scripts/assemble-context.sh`, which
generates `.brain/_CONTEXT.md` and injects it into context. It contains:
- Pointers to CKIS (`_MEMORY.md`, `_overview.md`, architecture spec)
- Last 3 session summaries
- Open decisions and bugs
- Top of `GRAPH_REPORT.md` (if Graphify has run)

You don't need to read `_CONTEXT.md` again — it's already in context.

## During the session — what's auto-captured

The `PostToolUse` hook runs `.brain/scripts/log-tool-event.sh` after every
Bash call and silently appends one line to `.brain/sessions/_active.md`
**only** for these objectively important events:

- `npm run build` / `npm test` / `npm run lint` → success or failure (with last
  ~8 lines of output on failure, so the error is preserved next session)
- `git commit` → SHA + message + diffstat

The `UserPromptSubmit` hook runs `.brain/scripts/log-compact.sh` on every user
prompt but only acts on `/compact` commands — everything else is ignored. When
detected, it writes a timestamp breadcrumb to `.brain/.compact-triggers`.

Everything else (file edits, reads, other shell commands, regular prompts) is
**not logged** — that would be noise. The Stop hook merges `_active.md` into
the final session log under `## Iterations`. This means: every build, every
test, every commit you make in a session is permanently in the brain —
searchable, visible to the next session, and impossible to lose to a `/clear`.

When `/compact` runs, the Stop hook extracts the full summary from the session
JSONL transcript and writes it to `.brain/sessions/compacts/<timestamp>-compact.md`.
The session file gets a `## Compactions` section with a pointer and a 200-char
excerpt — the full summary is never auto-inlined to keep `_CONTEXT.md` lean.

## During the session

When the work warrants it, write to:

- **`.brain/decisions/YYYY-MM-DD-<slug>.md`** — for any decision Eduardo
  makes about Korvex Web (architecture, dependency, deploy, scope). Use the
  CKIS decision-log format. See `.brain/decisions/README.md`.
- **`.brain/bugs/YYYY-MM-DD-<slug>.md`** — when a bug is found *and* fixed,
  capture the lesson (root cause, why it happened, how to prevent it). The
  patch lives in the commit; this file is for the *why*.

Important decisions also get a one-line cross-post to
`~/Documents/Second Brain/00-inbox/_MEMORY.md` Open Decisions.

## Before ending the session

The Stop hook fills in the objective metadata automatically:
- Iterations (every build/test/lint/commit, with timestamps)
- Commits made, files changed, duration, branch state

Your only job is the **narrative `## Summary`** — and only when it adds
value. If the session was a routine commit-and-iterate cycle, the iteration
log already tells the story. Fill in the Summary when:

- A non-obvious decision was made mid-session
- A bug had a *why* worth remembering (root cause, not patch)
- Something is unfinished and the next session needs to know

Format: 2–4 bullets max. What was done · What was decided · What's next.
Skip it if the iteration log + commits speak for themselves.

## CKIS bridge — when to escalate

| Situation | Goes to |
| --- | --- |
| Routine code change, bug fix, refactor | Just commit. No brain entry needed. |
| Decision about *this* project | `.brain/decisions/` |
| Bug worth a postmortem | `.brain/bugs/` |
| Strategic / cross-project / personal | CKIS `_MEMORY.md` + `02-projects/korvex/_overview.md` |
| Pattern reusable across projects | CKIS `03-knowledge/permanent-notes/` |

When in doubt: project decision → `.brain/`. Strategic → CKIS.

## Hard rules

- Never modify `.brain/_CONTEXT.md` by hand — it's regenerated each session.
- Never delete files in `.brain/decisions/` or `.brain/bugs/` — supersede instead.
- `.brain/sessions/` is gitignored (personal); `decisions/` and `bugs/` are committed.
- Graphify rebuilds `.brain/graph/` on every commit (post-commit hook). Don't edit it.
