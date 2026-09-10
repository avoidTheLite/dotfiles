# AGENTS.md

Entry point for agents working in this repository. Humans can start at [README.md](README.md); both documents stay in this tree so a clone is enough.

A short prompt is enough. Follow this file and the skill it points to. Do not invent a second generator.

## Read first

1. [identity/workspace-standards.json](identity/workspace-standards.json) — constraints (pnpm + Turborepo, Node 22, Pino, no `turbo install`).
2. This file, then the skill for the route below.
3. [README.md](README.md) — machine setup, CLI, and layout.

Do not assume the clone lives at `~/dotfiles`. The repo root is the directory that contains this file. Invoke the CLI as `scripts/dotfiles` from that root (or `dotfiles` if `scripts/install.sh` put it on `PATH`).

## Route the request

### New application, service, or product

Use this path when standing up something **new**: an application, service, product, monorepo, or any "scaffold / generate / create a new …" request.

1. Do **not** hand-write `apps/` or `turbo.json`.
2. Follow [agent-skills/skills/scaffold-monorepo/SKILL.md](agent-skills/skills/scaffold-monorepo/SKILL.md).
3. If the request **does not name** the project, use the committed example naming (`projectName` `demo`, scope `@demo`) and:

   ```sh
   scripts/dotfiles install /tmp/demo --example
   ```

   Source: [identity/generation/examples/react-node-monorepo.json](identity/generation/examples/react-node-monorepo.json). Target an empty directory **outside** this checkout (`/tmp/demo` unless the user gave a path).
4. If they **did** name it, keep `--example` and pass `--name <kebab-slug> --scope @<kebab-slug>` into an empty directory they chose (or `/tmp/<kebab-slug>`).
5. Confirm `config/ports.json` and `.env.example` exist in the target. Do not run `turbo install`. Run `pnpm install` only if asked to start or test the app.

A single-folder (non-monorepo) project is [scripts/init-project.sh](scripts/init-project.sh), not this CLI. Python FastAPI (`backend_service`) is planned, not generated.

### Existing repo: add UI from the registry

Use this path when the workspace **already exists** and they want standard components, primitives, molecules, or a shadcn install.

1. Do **not** copy files out of `identity/components/`.
2. Run `scripts/dotfiles install-components` (current repo) or `scripts/dotfiles install-components <app-or-ui-dir>`.
3. Read [identity/components/README.md](identity/components/README.md). Versioning is the git SHA (`avoidTheLite/dotfiles/standard-ui#<sha>`).
4. Later refreshes: `scripts/dotfiles sync-components`.

### Existing generated monorepo: add another app

After `pnpm install` in a repo this CLI already generated:

```sh
pnpm exec turbo gen frontend_app
pnpm exec turbo gen node_backend
```

That generator installs the same shadcn registry into a new frontend. Do not re-run `dotfiles install` into a filled workspace unless they asked to overwrite (`--force`).

### Compare two configurations (hypothesis test)

When they want to measure a change (two models, two prompt iterations, two commits) for quality, speed, or tokens:

1. Read [identity/generation/DEV_LOOPS.md](identity/generation/DEV_LOOPS.md) (Comparison runs).
2. Default: two **full-tree** git SHAs, one committed scenario, no overlays. Schema: [identity/generation/comparison-run.schema.json](identity/generation/comparison-run.schema.json).
3. Do not invent a second eval tool. Do not run fan/overlay unless they asked and flagged paths. CI does not spend tokens.

## Other skills

| Request | Skill |
| --- | --- |
| Idea capture / PRD | [agent-skills/skills/idea-capture/SKILL.md](agent-skills/skills/idea-capture/SKILL.md), [agent-skills/skills/idea-to-prd/SKILL.md](agent-skills/skills/idea-to-prd/SKILL.md) |
| GitHub About text | [agent-skills/skills/github-repo-description/SKILL.md](agent-skills/skills/github-repo-description/SKILL.md) |

Portable prompt copies: [agent-skills/prompts/](agent-skills/prompts/).

## This repo (dotfiles itself)

- Machine editor/CLI symlinks: `sh scripts/install.sh` (uses the directory this script lives in).
- Validate: `bash scripts/validate.sh`.
- Contract for CI goldens, agent inspect-fix, and homelab Docker: [identity/generation/DEV_LOOPS.md](identity/generation/DEV_LOOPS.md).
- Ports: committed [config/ports.json](config/ports.json) (CI-validated). [.env.example](.env.example) is the intended dotenv override (gitignored `.env`); generated Vite/Express do not load it yet. Schema: [identity/generation/ports.schema.json](identity/generation/ports.schema.json).
