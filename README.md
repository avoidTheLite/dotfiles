# Dotfiles

This repository is the single source of truth for your development environment across Windows (with WSL2), macOS, and Linux.

Style and quality decisions live under **`guides/`** (role-first: `monorepo/`, `server/`, `client/`, then
language, plus `platform/` for **TypeScript and Python baselines**, design, infrastructure, and
`validation/` for branch, a11y, and privacy rules). The **monorepo** subfolders hold **only** pnpm and
Turborepo workspace rules. Start at [guides/INDEX.md](guides/INDEX.md). The [CHANGELOG](CHANGELOG.md) is the
running, plain-language log of what changed; CI enforces that it stays in sync with guide and validation
edits.

The root [STYLE_GUIDE_JAVASCRIPT.md](STYLE_GUIDE_JAVASCRIPT.md) is a short index into the TypeScript guides.

## Continuous integration

From the repository root, with **Node 20+** and **git** available:

```sh
bash scripts/validate.sh
```

On pull requests, **GitHub Actions** runs the same checks (and **gitleaks**). **pre-commit** can call the same
script: install with [pre-commit](https://pre-commit.com) and `pre-commit install` (see
[.pre-commit-config.yaml](.pre-commit-config.yaml)). Topic branch names for **this** repository are enforced
in CI via [config/branch-standards.json](config/branch-standards.json) — copy and edit that file in other
repos to set your own pattern.

## Repository layout

```text
dotfiles/
├── CHANGELOG.md
├── STYLE_GUIDE_JAVASCRIPT.md   # pointer into guides/ (TypeScript)
├── .github/
│   └── workflows/validate.yml
├── config/
│   └── branch-standards.json   # this repo’s branch name regex; copy per project
├── guides/
│   ├── INDEX.md
│   ├── manifest.json
│   ├── monorepo/…              # pnpm, Turborepo, workspace layout only
│   ├── platform/               # TypeScript + Python language baselines, design, infra
│   ├── server/…, client/…
│   └── validation/            # a11y bar, branches, privacy, future security
├── scripts/
│   ├── install.sh
│   ├── init-project.sh
│   ├── validate.sh
│   └── validate/               # node scripts (manifest, links, changelog, …)
├── vscode/
│   ├── settings.json
│   └── extensions.txt
├── devcontainer/
│   └── devcontainer.json
├── eslint/
│   └── eslint.base.js
├── prettier/
│   └── prettier.base.js
└── project-template/
    ├── .devcontainer/
    │   └── devcontainer.json
    ├── .vscode/
    │   └── settings.json
    ├── eslint.config.js
    ├── .prettierrc.js
    └── .gitignore
```

## One-time machine setup

1. Clone this repository to `~/dotfiles`.
2. Run:

   ```sh
   sh ~/dotfiles/scripts/install.sh
   ```

3. The script:
   - Detects `wsl`, `macos`, or `linux`
   - Symlinks your editor settings file for VS Code and Cursor to `~/dotfiles/vscode/settings.json`
   - Is idempotent and reports `created`, `already-correct`, or `replaced`

## Scaffold a new project

From the directory where you want the new project folder:

```sh
sh ~/dotfiles/scripts/init-project.sh my-project
```

This creates `./my-project` from `~/dotfiles/project-template`, replaces `__PROJECT_NAME__` placeholders, and prints next steps.

## Updating base configs

Base configs live in:

- `~/dotfiles/eslint/eslint.base.js`
- `~/dotfiles/prettier/prettier.base.js`
- `~/dotfiles/vscode/settings.json`
- `~/dotfiles/devcontainer/devcontainer.json`

Template projects are wired to load ESLint and Prettier from your home dotfiles path. Updating base configs affects:

- New projects scaffolded after the update (immediately)
- Existing projects that still reference `~/dotfiles/*` in their config extension files (on next lint/format run)

If you need to freeze a project, copy the resolved config into the project itself instead of referencing dotfiles.

## Style-guide-aligned defaults in this repo

- Node version: `22`
- ESLint format: flat config (`eslint.config.js`) only
- Prettier: `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`
- Editor integration:
  - Prettier as default formatter
  - Format on save enabled
  - ESLint fix on save set to explicit

## Style guide gaps that were flagged

These values were not explicitly defined in the style guides under `guides/` (see [platform/typescript/STYLE_GUIDE.md](guides/platform/typescript/STYLE_GUIDE.md)) and were confirmed during setup:

- Node version pinned to `22`
- Tab width pinned to `2`

The style guide also does not list a canonical ESLint plugin inventory; this repo includes only plugins needed to enforce explicitly stated lint behavior (node protocol imports, explicit TypeScript import extensions, and type-only import style).
