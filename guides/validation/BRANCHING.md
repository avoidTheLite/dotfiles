# Validation — branches and pull requests

> **Scope:** How this **dotfiles** repository expects work to land. Other Git repositories can copy
> [config/branch-standards.json](../../config/branch-standards.json) and adjust the `headBranchPattern` field
> so each team’s naming rules live in one place. CI in each repo should read the same file when possible.

## Default branch

- **`main`** is the integration branch. Direct pushes to `main` should be reserved for maintainers; prefer
  pull requests for changes that other people need to read.

## Topic branch names (this repository)

- Use one of the prefixes **`feature/`**, **`fix/`**, **`chore/`**, or **`docs/`**, followed by a **kebab-case**
  slug: lowercase letters, digits, and hyphens (no leading hyphen, no underscores in this repository).
- **Dependabot** (and similar bots) are allowed: branches starting with `dependabot/` are permitted by the
  pattern in [config/branch-standards.json](../../config/branch-standards.json) so you do not have to merge
  bot PRs with a manual branch rename.
- The GitHub Actions **validate** workflow enforces the pattern for pull request **head** branches.

## Pull requests

- **Describe intent** in the title (Conventional Commits style is welcome but not machine-enforced in this
  repo at the time of writing). Link related issues or specs when they exist in another system.
- **Changelog:** When you change files under [guides/](../), [scripts/validate/](../../scripts/validate/),
  [.github/](../../.github/), or the branch-standards config, you **must** update [CHANGELOG.md](../../CHANGELOG.md)
  in the same change so the running log matches what reviewers see. CI enforces that rule on pull
  requests.

## Related

- [PRIVACY.md](PRIVACY.md)
- [manifest.json](../manifest.json) for machine-readable guide lists
