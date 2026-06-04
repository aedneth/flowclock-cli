# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |
| < latest | ❌ — update to latest |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: eduardoa.borjas@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive a response within 48 hours. If confirmed, a patch will be released within 7 days.

## Supply Chain Security

This project implements zero-trust npm security:

- **`ignore-scripts=true`** in `.npmrc` — blocks all postinstall/preinstall lifecycle scripts during `npm install`/`npm ci`. Prevents supply chain attacks via compromised transitive dependencies.
- **Explicit native module whitelist** — only named, reviewed native modules (listed in CI) are allowed to compile. All others are blocked.
- **Pinned GitHub Actions** — all Actions are pinned to a specific commit SHA, not a mutable tag. This prevents compromised Action tags from injecting malicious steps.
- **`npm publish --provenance`** — every published release includes a signed SLSA attestation linking the package to the exact GitHub Actions run that built it. Verify with: `npm audit signatures <package>@<version>`
- **`npm ci` in all CI jobs** — never `npm install`. Enforces exact cryptographic hash matching against `package-lock.json`.
- **Minimum permissions** — each CI job declares only the permissions it needs. Default is `permissions: {}` (deny all).
- **Weekly automated audit** — the Security Audit workflow runs every Monday at 09:00 UTC and fails on any moderate or higher vulnerability.

## Known Mitigations

Any known vulnerability mitigations (e.g., transitive dependency overrides) are documented in the relevant CI workflow files with inline comments.
