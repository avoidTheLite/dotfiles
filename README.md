# Dotfiles

This repository is the single source of truth for your development environment across Windows (with WSL2), macOS, and Linux.

TypeScript formatting and linting decisions live under **`guides/`** (role-first:
`monorepo/`, `server/`, `client/`, then language). Start at
[guides/INDEX.md](guides/INDEX.md); the root [STYLE_GUIDE_JAVASCRIPT.md](STYLE_GUIDE_JAVASCRIPT.md)
file is a short index into those guides.

## Repository layout

```text
dotfiles/
├── STYLE_GUIDE_JAVASCRIPT.md   # pointer into guides/ (TypeScript)
├── guides/
│   ├── INDEX.md
│   ├── manifest.json
│   ├── monorepo/typescript/STYLE_GUIDE.md
│   ├── server/typescript/STYLE_GUIDE.md
│   ├── server/python/STYLE_GUIDE.md
│   ├── client/typescript/STYLE_GUIDE.md
│   └── client/python/STYLE_GUIDE.md
├── README.md
├── scripts/
│   ├── install.sh
│   ├── init-project.sh
│   └── init-monorepo.sh
├── vscode/
│   ├── settings.json
│   └── extensions.txt
├── devcontainer/
│   └── devcontainer.json
├── eslint/
│   └── eslint.base.js
├── prettier/
│   └── prettier.base.js
├── project-template/              # single-package scaffold
│   ├── .devcontainer/
│   │   └── devcontainer.json
│   ├── .vscode/
│   │   └── settings.json
│   ├── eslint.config.js
│   ├── .prettierrc.js
│   └── .gitignore
└── project-template-monorepo/     # full-stack monorepo scaffold
    ├── .devcontainer/
    │   └── devcontainer.json
    ├── .vscode/
    │   └── settings.json
    ├── eslint.config.js
    ├── .prettierrc.js
    ├── .gitignore
    ├── package.json
    ├── pnpm-workspace.yaml
    ├── turbo.json
    └── packages/tsconfig/
        ├── package.json
        └── base.json
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

## Scaffold a monorepo

For a full-stack monorepo (pnpm workspaces + Turborepo + shared tsconfig):

```sh
sh ~/dotfiles/scripts/init-monorepo.sh my-project
```

This creates `./my-project` from `~/dotfiles/project-template-monorepo`, substitutes placeholders, initializes a git repo on `main`, and commits the scaffold.

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

These values were not explicitly defined in the style guides under `guides/` (see [monorepo/typescript/STYLE_GUIDE.md](guides/monorepo/typescript/STYLE_GUIDE.md)) and were confirmed during setup:

- Node version pinned to `22`
- Tab width pinned to `2`

The style guide also does not list a canonical ESLint plugin inventory; this repo includes only plugins needed to enforce explicitly stated lint behavior (node protocol imports, explicit TypeScript import extensions, and type-only import style).
