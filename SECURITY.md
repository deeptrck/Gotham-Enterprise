# Gotham Enterprise Security Checks

Gotham uses two repository gates before code can reach the deployment job.

## Secret scanning

Gitleaks is configured in `.gitleaks.toml` and runs in GitHub Actions through the pinned `gitleaks/gitleaks-action@v2.3.9` action. A staged-file pre-commit hook is defined in `.pre-commit-config.yaml`.

Install the local tooling through an approved package-management process, then enable the hook:

```bash
pre-commit install
pre-commit run --all-files
```

To scan the repository directly:

```bash
gitleaks detect --source . --config .gitleaks.toml --redact --verbose
```

Never commit `.env.local`, `.env.production`, database URLs, Auth0 secrets, API keys, private keys, or cloud credentials. The repository allowlist covers only non-secret templates and generated build directories.

## Dependency audit

The `security:deps` script runs:

```bash
npm audit --omit=dev --audit-level=high
```

This intentionally fails for high or critical production dependency vulnerabilities. It is not safe to weaken the threshold merely to make a deployment green. Remediation should upgrade the affected dependency, replace it, or document a reviewed temporary exception with an owner and expiry date.

Run locally with:

```bash
npm ci
npm run security:deps
```

The current baseline includes transitive and direct findings that require dependency remediation, including vulnerabilities reported against `next`, `mongoose`, `axios`, `jspdf`, `jspdf-autotable`, `sharp`, and related packages. The build can pass while the audit gate fails; both results must be addressed before production deployment.

## CI order

The GitHub workflow runs secret scanning, locked dependency installation, dependency audit, lint, and build before the EC2 deployment job. The deployment job is blocked when any security or build step fails.
