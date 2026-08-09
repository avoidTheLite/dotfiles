# Validation — privacy and safe examples

> **Scope:** How to keep this **public** repository from accidentally teaching bad habits with real
  credentials, and how to use optional private areas on your own machine.

## No real secrets in git

- Do not commit API keys, tokens, **passwords, connection strings with real host credentials**, or personal
  data. Use obviously fake values in documentation (`sk-test-...`, `REDACTED`, `****`) and refer to a secret
  manager in prose where real systems are described.
- **Gitleaks** runs in GitHub Actions and can run locally. Tune [.gitleaks.toml](../../.gitleaks.toml) with
  narrow allowlists when a false positive is documented; do not add broad “allow everything under guides/”
  rules that disable detection for real mistakes.

## Local or gitignored private notes

- You may keep a **private** directory that is not tracked (add it to `.gitignore` if you create it in this
  repository) for employer-specific runbooks, URLs, or example YAML that is safe on your laptop but not for
  publication. The guides under [guides/](../) are written so they do not require that material.

## Related

- [SECURITY_PATTERNS.md](SECURITY_PATTERNS.md) for future agent and prompt-injection guardrails
- [BRANCHING.md](BRANCHING.md) for how changes land
