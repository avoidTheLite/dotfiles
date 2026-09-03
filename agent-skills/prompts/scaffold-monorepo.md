# Prompt: Scaffold Monorepo

_Portable version of the `scaffold-monorepo` skill — same instructions, framed as a standalone prompt so it can be handed to an agent context that doesn't support the Skill file format. When running inside an agent with skills enabled, prefer the skill itself in `skills/scaffold-monorepo/`._

## Purpose

Scaffold a new pnpm + Turborepo monorepo with a React 18 Vite + Tailwind app and an Express 5 Node service by running the **dotfiles CLI**, not by writing turbo/plop files by hand.

## When to use

Trigger on: "scaffold a new app," "generate a monorepo," "create a React and Node repo," "use the turbo generator," "dotfiles install," or any request to stand up a fullstack TypeScript workspace from these dotfiles.

Do NOT use this for a single non-monorepo folder (`scripts/init-project.sh` / `project-template`), and NOT for Python FastAPI (`backend_service` is planned, not generated). To add an app to an **already generated** repo, use `pnpm exec turbo gen frontend_app` or `pnpm exec turbo gen node_backend` after `pnpm install`.

## Core principle

This repository already owns code generation. Run `dotfiles install`. Do not invent a parallel generator, copy `examples/battleship`, or assemble `apps/` and `packages/` by hand.

## Flow

1. **Confirm names.** Need kebab-case `projectName`, npm `scope` (default `@` + projectName), and an empty target directory. Optional description and app names (default `web` + `api`). Restate and confirm before writing files.
2. **Config.** `--config` is a **file path**, never a raw JSON string. Schema: `identity/generation/scaffold-config.schema.json`. Example: `identity/generation/examples/react-node-monorepo.json`. `packages` must be all of `tsconfig`, `types`, `util`. For the default layout, `dotfiles install --example --name my-app --scope @my-app` is enough.
3. **Generate.** Prefer `dotfiles` on PATH (after `sh ~/dotfiles/scripts/install.sh`). Otherwise `~/dotfiles/scripts/dotfiles`. Use `--force` only if the user explicitly wants to overwrite. Generated frontends install `identity/components` through the shadcn registry (`src/components/ui/` and `src/components/molecules/`). For an existing repo, `dotfiles install-components [target-dir]` uses the same registry (current repo when the path is omitted).
4. **Install with pnpm.** Never `turbo install` (that hits a global Turbo, no lockfile, and a missing `install` task). Run `pnpm install`, then `pnpm exec turbo --version`, `pnpm test`, `pnpm dev`. Web is http://localhost:5173; API is port 3000.
5. **Later apps.** `pnpm exec turbo gen frontend_app` or `pnpm exec turbo gen node_backend`.

## Constraints

- Do not copy `identity/scaffolding/templates/` by hand; the CLI renders Handlebars.
- Do not use `project-template/` for this fullstack layout.
- Do not invent extra apps, databases, or Python services on first generate.
- Follow `identity/workspace-standards.json` (pnpm + Turborepo, React 18, Express 5, Node 22).

## Output

A generated workspace at the agreed path, plus the exact commands you ran and the next step (`pnpm install` / `pnpm dev`). If the CLI is missing, tell the user to run `sh ~/dotfiles/scripts/install.sh` (and ensure `~/.local/bin` is on PATH) rather than falling back to hand-written files.
