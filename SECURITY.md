# Security Policy

## Supported versions

flowclock is pre-1.0; security fixes land on the latest released `0.x` line.

| Version      | Supported |
| ------------ | --------- |
| latest `0.x` | ✅        |
| older        | ❌        |

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue or PR.

- Preferred: open a [GitHub private security advisory](https://github.com/aedneth/flowclock-cli/security/advisories/new).
- Or email: **eduardoa.borjas@gmail.com** with the subject `flowclock security`.

Include reproduction steps, affected version, and impact. You'll get an
acknowledgement within a few days. Please give a reasonable window to fix and
release before any public disclosure.

## Scope notes

flowclock reads and writes local files only (config + `sessions.json`) and, when
run, an optional MCP stdio server. It makes no network calls by default. The
optional `apiEndpoint` config (future) would be the only outbound path and is
opt-in. Reports about local file handling, the MCP tool surface, or dependency
vulnerabilities are all in scope.
