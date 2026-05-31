# flowclock-cli

> Flowtime count-up terminal timer (HUD, not Pomodoro) with silent session logging.

**Status:** planning — architecture via `/ultraplan` (Claude Opus 4.8).
**Part of:** Korvex agent-native developer-tool suite.
**License:** AGPL-3.0 + Dual Commercial — **FINAL**. Open source and free for the
public; commercial licenses sold separately. MIT/Apache are rejected on purpose:
they would let a company use and resell the work without a commercial agreement.

## Agent-native by design
Like `gh` and `vercel`, this CLI is built to be driven by **both humans and
terminal AI agents** (Claude Code, Codex, Gemini CLI, Hermes, OpenClaw,
OpenCode, DeepSeek) on Linux, macOS and Windows — non-interactive mode,
`--json` output, deterministic exit codes, and an MCP/tool manifest.

## Planning context
Architecture inputs live in [`docs/planning/`](docs/planning) (kept private;
stripped before the public release per `github-repo-growth-standard`).
