# Changelog

This file is a running log of what changed in this repository, in plain language. The validation suite enforces that it stays in sync whenever you change guides, validation scripts, CI, or the branch-name policy. Each pull request that touches those areas should add bullets under **Unreleased** so reviewers can see the human story behind the diff.

## Unreleased

- Added a full validation pipeline: manifest checks, internal markdown link resolution, CHANGELOG structure, exception-marker format, optional local gitleaks, and a GitHub Actions workflow that enforces the same on push and on pull requests.
- Added a per-repository branch name policy in `config/branch-standards.json` and a CI check that enforces the pattern for this dotfiles repo (topic branches: `feature/`, `fix/`, `chore/`, `docs/`, plus `dependabot/` for automation). Other projects can copy the file and edit the regular expression in one place.
- Added new guides under `guides/platform/design/` (product and component principles for Shadcn-style UIs) and `guides/platform/infra/` (Terraform and OpenTofu compatible infrastructure conventions).
- Added `guides/validation/` for repository quality: accessibility expectations, branching and privacy practices, and a short placeholder for future prompt-injection and security-pattern checks. Accessibility standards are documented here; machine checks for live UIs belong in application repositories.
- Bumped the machine-readable [guides/manifest.json](guides/manifest.json) version to 4 to reflect new guide paths and the expanded automation surface.
