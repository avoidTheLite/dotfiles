---
name: scaffold-monorepo
description: Scaffolds a new pnpm + Turborepo monorepo with a React 18 Vite + Tailwind app and an Express 5 Node service using the dotfiles CLI (turbo gen / plop templates). Trigger on any request to create a new application, service, product, or monorepo ("scaffold," "generate," "create a new …," "dotfiles install"). If no project name is given, use the committed example (demo / @demo) and `scripts/dotfiles install /tmp/demo --example`. Do NOT hand-write turbo.json, pnpm-workspace.yaml, or starter apps/packages. NOT for adding UI to an existing repo (use install-components / the shadcn registry), NOT for a single non-monorepo folder (scripts/init-project.sh), and NOT for Python FastAPI (backend_service is planned, not generated).
---

# Scaffold a React + Node monorepo

## Core principle

This repository already owns code generation. When the user wants a new fullstack TypeScript app, **run the `dotfiles` CLI**. Do not invent a parallel turbo/plop setup, copy `examples/battleship`, or assemble `apps/` and `packages/` by hand.

## When to use

Use this skill when the user wants a **new** pnpm + Turborepo workspace with:

- `apps/web` — React 18, Vite, Tailwind
- `apps/api` — Express 5 TypeScript service (`/health`, `/api/hello`)
- `packages/tsconfig`, `packages/types`, `packages/util`

Hand off instead of using this skill when (see [AGENTS.md](../../../AGENTS.md) routes):

- They want **UI in an existing repo** → `scripts/dotfiles install-components` (shadcn registry)
- They want to **add an app to an already generated repo** → after `pnpm install`, `pnpm exec turbo gen frontend_app` or `pnpm exec turbo gen node_backend`
- They want a **single** non-monorepo folder → `scripts/init-project.sh`
- They want a **Python FastAPI** service → say the `backend_service` generator is planned, not available

## Prerequisites

1. This clone is the source of truth (see [AGENTS.md](../../../AGENTS.md)). It may not be at `~/dotfiles`.
2. Invoke `scripts/dotfiles` from the repo root, or `dotfiles` on PATH after `sh scripts/install.sh`.
3. **Node 22+** and **pnpm 10** are installed. Do not use a global `turbo` binary for install.

## Session flow

### 0. No name in the request

If they asked to create a new application, service, or product and **did not name it**, do not invent names and do not ask. From the **dotfiles repo root**:

```sh
scripts/dotfiles install /tmp/demo --example
```

That uses `identity/generation/examples/react-node-monorepo.json` (`demo` / `@demo`). Confirm `config/ports.json` and `.env.example` in the target. Stop unless asked to run `pnpm install`.

### 1. Confirm target and names

Ask only for what the JSON config needs if it is not already stated:

- **projectName** — kebab-case, starts with a letter (`my-app`)
- **scope** — npm scope (`@my-app`); default `@` + projectName
- **target directory** — empty dir, or a path that does not already contain a project
- Optional **description**, **app names** (default `web` + `api`)

Restate the plan in one sentence and confirm before writing files.

### 2. Write the config (or use --example)

Canonical schema: `identity/generation/scaffold-config.schema.json`  
Canonical example: `identity/generation/examples/react-node-monorepo.json`

Default config:

```json
{
  "projectName": "my-app",
  "scope": "@my-app",
  "description": "Generated React + Node monorepo",
  "apps": [
    { "type": "frontend_app", "name": "web" },
    { "type": "node_backend", "name": "api" }
  ],
  "packages": ["tsconfig", "types", "util"]
}
```

Rules the CLI will enforce:

- `packages` must include **all three** shared packages (no subset, no duplicates)
- `description` may contain quotes; the CLI JSON-escapes it
- Unknown app types (including Python) are rejected

If the user just wants the default React + Node layout, `--example` plus `--name` / `--scope` is enough. Do not pass a raw JSON string to `--config`; it is a **file path**.

### 3. Run the generator

From an **empty** directory (or pass an empty target path):

```sh
dotfiles install --example --name my-app --scope @my-app
```

Or with a config file:

```sh
dotfiles install ./my-app --config ./scaffold.json
```

If `dotfiles` is not on `PATH`:

```sh
scripts/dotfiles install --example --name my-app --scope @my-app
```

The CLI copies turbo/plop generators into the target (`turbo/generators/`), renders the workspace, writes `config/ports.json` and `.env.example`, and installs the `identity/components` shadcn registry into each frontend (`src/components/ui/` and `src/components/molecules/`). Use `--force` only when the user explicitly wants to overwrite a non-empty directory.

To install the same library into an existing repo without generating a monorepo:

```sh
dotfiles install-components
dotfiles install-components ./apps/web
```

### 4. Install and verify with pnpm

Never run `turbo install`. That uses a global Turbo binary, finds no lockfile, and looks for a non-existent `install` task.

```sh
pnpm install
pnpm exec turbo --version
pnpm test
pnpm dev
```

Vite listens on http://127.0.0.1:5173 and proxies `/api` to port 3000. The API reads `process.env.PORT` (default 3000). `config/ports.json` and `.env.example` record the intended homelab/docker ports contract; generated apps do not load them yet.

### 5. Adding more apps later

After the first install, generators live in the generated repo:

```sh
pnpm exec turbo gen frontend_app
pnpm exec turbo gen node_backend
```

Do not re-run `dotfiles install` into a filled workspace unless the user asks to overwrite (`--force`).

## Constraints

- Do not scaffold by copying files out of `identity/scaffolding/templates/` yourself; the CLI renders Handlebars and installs generators.
- Do not use `project-template/` for this fullstack layout.
- Do not invent extra apps, databases, or Python services in the first generate.
- Follow `identity/workspace-standards.json` (pnpm + Turborepo, React 18, Express 5, Node 22).
- Keep the generated tree; customize product code after `pnpm install` succeeds.

## References

- `identity/generation/examples/react-node-monorepo.json`
- `identity/generation/scaffold-config.schema.json`
- `identity/generation/capability-manifest.json`
- `identity/scaffolding/README.md`
- `identity/workspace-standards.json`
