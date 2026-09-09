# Prompt: Scaffold Monorepo

_Portable version of the `scaffold-monorepo` skill — same instructions, framed as a standalone prompt so it can be handed to an agent context that doesn't support the Skill file format. When running inside an agent with skills enabled, prefer the skill itself in `skills/scaffold-monorepo/`._

## Purpose

Scaffold a new pnpm + Turborepo monorepo with a React 18 Vite + Tailwind app and an Express 5 Node service by running the **dotfiles CLI**, not by writing turbo/plop files by hand.

## When to use

Trigger on any request to create a new application, service, product, or monorepo. If no project name is given, use the committed example (`demo` / `@demo`) and `scripts/dotfiles install /tmp/demo --example`.

Do NOT use this to add UI to an existing repo (`dotfiles install-components` / the shadcn registry), for a single non-monorepo folder (`scripts/init-project.sh`), or for Python FastAPI (`backend_service` is planned). To add an app to an **already generated** repo, use `pnpm exec turbo gen frontend_app` or `pnpm exec turbo gen node_backend` after `pnpm install`.

## Core principle

This repository already owns code generation. Run `dotfiles install`. Do not invent a parallel generator, copy `examples/battleship`, or assemble `apps/` and `packages/` by hand.

## Flow

0. **No name given.** Do not invent names. From this clone: `scripts/dotfiles install /tmp/demo --example` (`demo` / `@demo`). Confirm `config/ports.json` and `.env.example` in the target. Stop unless asked to `pnpm install`.
1. **Confirm names.** If they named the project: kebab-case `projectName`, npm `scope` (default `@` + projectName), and an empty target directory. Optional description and app names (default `web` + `api`).
2. **Config.** `--config` is a **file path**, never a raw JSON string. Schema: `identity/generation/scaffold-config.schema.json`. Example: `identity/generation/examples/react-node-monorepo.json`. `packages` must be all of `tsconfig`, `types`, `util`. For the default layout, `dotfiles install --example --name my-app --scope @my-app` is enough.
3. **Generate.** Prefer `scripts/dotfiles` from this clone (or `dotfiles` on PATH after `sh scripts/install.sh`). Use `--force` only if the user explicitly wants to overwrite. Generated frontends install `identity/components` through the shadcn registry (`src/components/ui/` and `src/components/molecules/`). For an existing repo, `dotfiles install-components [target-dir]` uses the same registry (current repo when the path is omitted).
4. **Install with pnpm.** Never `turbo install` (that hits a global Turbo, no lockfile, and a missing `install` task). Run `pnpm install`, then `pnpm exec turbo --version`, `pnpm test`, `pnpm dev`. Ports come from `config/ports.json` (dotenv `.env` overrides). Defaults: web 5173, api 3000, bind 127.0.0.1.
5. **Later apps.** `pnpm exec turbo gen frontend_app` or `pnpm exec turbo gen node_backend`.

## Constraints

- Do not copy `identity/scaffolding/templates/` by hand; the CLI renders Handlebars.
- Do not use `project-template/` for this fullstack layout.
- Do not invent extra apps, databases, or Python services on first generate.
- Follow `identity/workspace-standards.json` (pnpm + Turborepo, React 18, Express 5, Node 22).

## Output

A generated workspace at the agreed path, plus the exact commands you ran and the next step (`pnpm install` / `pnpm dev`). If the CLI is missing, run `scripts/dotfiles` from this clone (or `sh scripts/install.sh` so `dotfiles` is on PATH) rather than falling back to hand-written files.
