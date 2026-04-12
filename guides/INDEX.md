# Engineering style guides

These documents target **full-stack monorepo** applications (shared packages, `apps/api`, `apps/web`, polyglot services). Layout is **role first** (`monorepo` / `server` / `client`), then **language** — the same tree works for TypeScript and Python.

Read **TypeScript (monorepo)** before any other TypeScript guide; stack-specific guides add rules on top.

## Monorepo

| Guide | Use when |
|--------|-----------|
| [TypeScript](monorepo/typescript/STYLE_GUIDE.md) | ESM, `tsconfig`, ESLint/Prettier, editor, Vitest (server + client packages), DB test infra, pnpm, Turborepo, repo layout |

## Server

| Guide | Use when |
|--------|-----------|
| [TypeScript](server/typescript/STYLE_GUIDE.md) | `apps/api`, Express, Pino, errors, Zod env, Knex |
| [Python](server/python/STYLE_GUIDE.md) | APIs, workers, ORM, logging — **section map** to TypeScript server; fill tooling as you standardize |

## Client

| Guide | Use when |
|--------|-----------|
| [TypeScript](client/typescript/STYLE_GUIDE.md) | `apps/web`, React, Tailwind, TanStack Query, Zustand, RTL, MSW |
| [Python](client/python/STYLE_GUIDE.md) | Browser or desktop UI in Python — **section map** to TypeScript client; add stack when chosen |

## Versioning

**Source of truth is this repository at a specific git commit.** Anyone consuming these guides (humans, CI, editor rules, or generated docs) should treat the **commit SHA** of `~/dotfiles` (or whichever clone they use) as the version they are aligned with. When you pull or rebase this repo, you adopt whatever the guides say at **that** commit—there is no separate release channel.

[manifest.json](manifest.json) includes a numeric `version` field for tooling and quick comparison. Bump it when you make **normative** changes (new required rules, moved paths, renamed manifest `id`s, or anything that would break automation that keys off the manifest). That bump should land in the **same commit** as the prose or schema change so the pair stays atomic.

For downstream application repos that symlink shared configs from dotfiles: **record the dotfiles commit** you last validated against (for example in the app README or an internal runbook) when you need a paper trail or a controlled upgrade. Upgrading dotfiles is then a deliberate `git pull` (or pin to a tag) followed by fixing any new lint or template drift.

When a change both updates the guides and the enforcing configs in this repo (`eslint/`, `prettier/`, `project-template/`, etc.), prefer a **single commit** so the written rules and the machine-checked rules never disagree on `main`.

## Machine-readable index

For automation (rules, MCP, RAG), see [manifest.json](manifest.json).

## Legacy entry point

The repository root file [STYLE_GUIDE_JAVASCRIPT.md](../STYLE_GUIDE_JAVASCRIPT.md) is a short pointer into `guides/` (TypeScript-focused paths).
