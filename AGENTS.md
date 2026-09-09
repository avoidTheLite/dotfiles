# AGENTS.md

Entry point for agents working in this repository. Humans can start at [README.md](README.md); both documents stay in this tree so a clone is enough.

## Read first

1. [identity/workspace-standards.json](identity/workspace-standards.json) — constraints (pnpm + Turborepo, Node 22, Pino, no `turbo install`).
2. This file, then the skill that matches the request.
3. [README.md](README.md) — machine setup, CLI, and layout.

Do not assume the clone lives at `~/dotfiles`. The repo root is the directory that contains this file. Invoke the CLI as `scripts/dotfiles` from that root (or `dotfiles` if `scripts/install.sh` put it on `PATH`).

## Skills

| Request | Skill |
| --- | --- |
| Scaffold / generate a React + Node monorepo, including **scaffold the test app** | [agent-skills/skills/scaffold-monorepo/SKILL.md](agent-skills/skills/scaffold-monorepo/SKILL.md) |
| Idea capture / PRD | [agent-skills/skills/idea-capture/SKILL.md](agent-skills/skills/idea-capture/SKILL.md), [agent-skills/skills/idea-to-prd/SKILL.md](agent-skills/skills/idea-to-prd/SKILL.md) |
| GitHub About text | [agent-skills/skills/github-repo-description/SKILL.md](agent-skills/skills/github-repo-description/SKILL.md) |

Portable prompt copies: [agent-skills/prompts/](agent-skills/prompts/).

## Scaffold the test app

When the prompt is only **scaffold the test app** (no names, no path):

1. Do **not** hand-write `apps/` or `turbo.json`.
2. Target an empty directory **outside** this checkout, for example `/tmp/dotfiles-test-app`.
3. From this repo root:

   ```sh
   scripts/dotfiles install /tmp/dotfiles-test-app --example
   ```

4. That uses [identity/generation/examples/react-node-monorepo.json](identity/generation/examples/react-node-monorepo.json) (`demo` / `@demo`).
5. Confirm `config/ports.json` and `.env.example` exist in the target. Do not run `turbo install`. `pnpm install` is the next step only if asked to run the app.

## Install and generate (this repo)

- Machine editor/CLI symlinks: `sh scripts/install.sh` (uses the directory this script lives in).
- Generate: `scripts/dotfiles install <empty-dir> --example` or `--config identity/generation/examples/react-node-monorepo.json`.
- Validate this repo: `bash scripts/validate.sh`.
- Contract for CI goldens, agent inspect-fix, and homelab Docker: [identity/generation/DEV_LOOPS.md](identity/generation/DEV_LOOPS.md).
- Ports: committed [config/ports.json](config/ports.json) (CI-validated). Overrides via dotenv ([.env.example](.env.example) → gitignored `.env`). Schema: [identity/generation/ports.schema.json](identity/generation/ports.schema.json).
