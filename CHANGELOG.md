# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-31

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

[Unreleased]: https://github.com/aedneth/flowclock-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aedneth/flowclock-cli/releases/tag/v0.1.0
