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

## Releasing (maintainers)

Publishing is automated by [`.github/workflows/release.yml`](.github/workflows/release.yml),
which triggers on any `v*` tag push. The workflow audits, lints, typechecks,
tests, builds, creates a GitHub Release, and runs `npm publish --provenance`.

**One-time setup — add the `NPM_TOKEN` secret:**

1. Create an **automation** access token at
   <https://www.npmjs.com/settings/~/tokens> (type: _Automation_, so it bypasses
   2FA in CI). Scope it to publish `flowclock-cli`.
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, name it `NPM_TOKEN`, paste the token.
3. Until this secret exists, the **Publish to npm** step fails (everything else in
   the workflow still passes) — expected, and the only thing blocking publish.

**Cutting a release:**

```bash
# bump the version in BOTH package.json and src/version.ts (they must match —
# the manifest test enforces it), update CHANGELOG.md, then:
npm run build && npm test && npm run lint && npm run typecheck
npm publish --dry-run            # sanity-check the tarball contents
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags      # the tag push triggers the release workflow
```

## Reporting bugs / requesting features

Use the issue templates. For anything security-related, see
[SECURITY.md](SECURITY.md) — please do **not** open a public issue.

By contributing you agree your contributions are licensed under the project's
AGPL-3.0 license, and that the maintainer may also offer them under the
commercial license (see [LICENSE-COMMERCIAL](LICENSE-COMMERCIAL)).
