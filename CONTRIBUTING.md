# Contributing to flowclock

Thanks for your interest! flowclock is a small, focused tool — contributions
that keep it that way are very welcome.

## Project principles (please respect these)

flowclock's UX is deliberately minimal and **must not regress**:

- The HUD is **a single centered `HH:MM:SS` line** — no chrome, no boxes, no
  on-screen metrics, no visible control hints. Metrics go to logs, never the
  overlay.
- In-session controls (`p`/`r`/`q`) are **invisible**.
- It must **degrade gracefully** in a tiny window (draw nothing rather than
  partial garbage).
- It must **start instantly** — keep the HUD off heavy dependencies.
- **Agent-native is a requirement, not a feature**: every interactive flow needs
  a non-interactive equivalent, a `--json` form, and a deterministic exit code.

## Development

```bash
npm install
npm run build        # tsup → dist/
npm test             # vitest (unit + CLI integration)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write
```

Node.js 20+ is required.

## Pull requests

1. Branch from `main`.
2. Add or update tests — pure logic lives in `src/lib/**` and should be
   unit-tested; user-facing behavior gets a CLI integration test.
3. Make sure `npm run build && npm test && npm run lint && npm run typecheck`
   all pass.
4. Update `CHANGELOG.md` under the `Unreleased` heading.
5. Keep commits focused; describe the _why_ in the PR body.

## Reporting bugs / requesting features

Use the issue templates. For anything security-related, see
[SECURITY.md](SECURITY.md) — please do **not** open a public issue.

By contributing you agree your contributions are licensed under the project's
AGPL-3.0 license, and that the maintainer may also offer them under the
commercial license (see [LICENSE-COMMERCIAL](LICENSE-COMMERCIAL)).
