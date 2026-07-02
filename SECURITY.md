# Security Policy

## Reporting a vulnerability

If you discover a security issue, please contact the repository owner privately
rather than opening a public issue. Do not include exploit details or secrets in
public discussions.

## Secrets: the golden rules

- **Never commit secrets.** No API keys, passwords, JWT secrets, tokens, or
  connection strings in the repository — not in code, config, tests, or docs.
- **All secrets live in the deployment platform's environment variables**
  (e.g. Railway service variables). Locally, use `.env.local` / `.env`, which are
  git-ignored. See [`.env.example`](.env.example) for the required variable names
  (placeholders only).
- **`.env` and its variants are git-ignored** (`.env`, `.env.*`). Never force-add them.

## Production requirement: `MINIYO_JWT_SECRET`

`server/auth.js` reads the JWT signing secret from `MINIYO_JWT_SECRET` and falls
back to a **dev-only placeholder** when it is unset. This placeholder is for local
development only.

**In production you MUST set `MINIYO_JWT_SECRET` to a strong, random value.**
Running with the default placeholder means anyone can forge session tokens.

Generate a strong value, for example:

```bash
openssl rand -base64 48
```

Set it as an environment variable in your deployment platform (never in the repo).

## Rotating a leaked key

If a secret is ever exposed (committed, logged, or shared):

1. **Revoke/rotate immediately** at the provider:
   - Resend: delete the leaked API key in the Resend dashboard and create a new one.
   - JWT: generate a new `MINIYO_JWT_SECRET` (this invalidates existing sessions).
   - Admin credentials: change `MINIYO_ADMIN_PASSWORD` and reseed / update the account.
2. **Update the deployment platform** environment variables with the new value and redeploy.
3. **Invalidate anything derived** from the old secret (active sessions, cached tokens).
4. If the secret was committed to git history, treat the key as permanently
   compromised — rotation is the fix; purging history is optional cleanup, not a substitute.

## Automated protections

- **Gitleaks secret scanning** runs on every push and pull request via
  [`.github/workflows/secret-scan.yml`](.github/workflows/secret-scan.yml) and
  **fails the build** if a secret is detected. Configuration lives in
  [`.gitleaks.toml`](.gitleaks.toml).
- An optional local [`pre-commit`](.pre-commit-config.yaml) hook can run gitleaks
  before each commit (`pre-commit install`).
- **GitHub secret scanning and push protection** are enabled for this repository,
  blocking known secret formats from being pushed.
