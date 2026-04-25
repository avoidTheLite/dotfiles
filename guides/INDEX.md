# Engineering style guides

These documents target **full-stack monorepo** applications (shared packages, `apps/api`, `apps/web`, polyglot services). Layout is **role first** (`monorepo` / `server` / `client`), then **language** — the same tree works for TypeScript and Python.

**Platform** (`guides/platform/`) holds **product and component design** (for example [platform/design/DESIGN.md](platform/design/DESIGN.md) and [components](platform/design/components.md)) and **infrastructure as code** ([platform/infra/STYLE_GUIDE.md](platform/infra/STYLE_GUIDE.md)) — including Terraform- and OpenTofu-compatible conventions.

**Validation** ([validation/INDEX.md](validation/INDEX.md)) covers **repository quality**: branch naming, privacy and safe examples, accessibility bar for UIs, and a placeholder for future security-pattern checks.

Read **TypeScript (monorepo)** before any other TypeScript guide; stack-specific guides add rules on top. Read **Python (monorepo)** before any other Python guide.

## Monorepo

| Guide | Use when |
|--------|-----------|
| [TypeScript](monorepo/typescript/STYLE_GUIDE.md) | ESM, `tsconfig`, ESLint/Prettier, editor, Vitest (server + client packages), DB test infra, pnpm, Turborepo, repo layout |
| [Python](monorepo/python/STYLE_GUIDE.md) | Python 3.13, uv, Ruff, Pyright strict, Pydantic at boundaries, OpenAPI SSOT, pytest + Hypothesis, Turborepo task wiring for Python, repo layout |

## Server

| Guide | Use when |
|--------|-----------|
| [TypeScript](server/typescript/STYLE_GUIDE.md) | **Standalone** `apps/api`, Express, Pino, errors, Zod env, Knex; **mutually exclusive** with Python server for the same HTTP surface |
| [Python](server/python/STYLE_GUIDE.md) | **Standalone** FastAPI/server stack; **mutually exclusive** with TypeScript server for the same API; baseline in [Python (monorepo)](monorepo/python/STYLE_GUIDE.md) |

## Client

| Guide | Use when |
|--------|-----------|
| [TypeScript](client/typescript/STYLE_GUIDE.md) | `apps/web`, React, Tailwind, TanStack Query, Zustand, RTL, MSW |
| [Python](client/python/STYLE_GUIDE.md) | Browser or desktop UI in Python — **section map** to TypeScript client; defers shared Python rules to [Python (monorepo)](monorepo/python/STYLE_GUIDE.md) |

## Platform (design and infrastructure)

| Guide | Use when |
|--------|-----------|
| [Design / UX](platform/design/DESIGN.md) | Product principles, tokens, content, Shadcn-friendly assumptions |
| [Components](platform/design/components.md) | Shadcn-style `components/ui`, composition, testing pointers |
| [Infrastructure (IaC)](platform/infra/STYLE_GUIDE.md) | Terraform or OpenTofu HCL, fmt, tflint, state, and CI |

## Validation (repository and CI quality)

| Guide | Use when |
|--------|-----------|
| [Index](validation/INDEX.md) | List of all validation topic pages |
| [A11Y](validation/A11Y.md) | WCAG bar, what app CI should run (eslint-plugin-jsx-a11y, axe, etc.) |
| [Branching and PRs](validation/BRANCHING.md) | Default branch, topic branch names, [CHANGELOG](../CHANGELOG.md) policy |
| [Privacy](validation/PRIVACY.md) | No real secrets, gitleaks, optional `private/` notes |
| [Security patterns (stub)](validation/SECURITY_PATTERNS.md) | Future prompt-injection and SAST policy pointers |

## Other Python domains (stubs)

| Guide | Use when |
|--------|-----------|
| [Python (AI)](ai/python/STYLE_GUIDE.md) | Agents, CrewAI / LangGraph — placeholder; links to Python (monorepo) |
| [Python (CLI)](cli/python/STYLE_GUIDE.md) | Typer CLIs — placeholder; links to Python (monorepo) |
| [Python (data)](data/python/STYLE_GUIDE.md) | Polars / ETL — placeholder; links to Python (monorepo) |

## Versioning

**Source of truth is this repository at a specific git commit.** Anyone consuming these guides (humans, CI, editor rules, or generated docs) should treat the **commit SHA** of `~/dotfiles` (or whichever clone they use) as the version they are aligned with. When you pull or rebase this repo, you adopt whatever the guides say at **that** commit—there is no separate release channel.

The [CHANGELOG at the repository root](../CHANGELOG.md) is the human-readable, CI-checked running log. [manifest.json](manifest.json) includes a numeric `version` field for tooling and quick comparison. Bump it when you make **normative** changes (new required rules, moved paths, renamed manifest `id`s, or anything that would break automation that keys off the manifest). That bump should land in the **same commit** as the prose or schema change so the pair stays atomic.

For downstream application repos that symlink shared configs from dotfiles: **record the dotfiles commit** you last validated against (for example in the app README or an internal runbook) when you need a paper trail or a controlled upgrade. Upgrading dotfiles is then a deliberate `git pull` (or pin to a tag) followed by fixing any new lint or template drift.

When a change both updates the guides and the enforcing configs in this repo (`eslint/`, `prettier/`, `project-template/`, etc.), prefer a **single commit** so the written rules and the machine-checked rules never disagree on `main`.

## Machine-readable index

For automation (rules, MCP, RAG), see [manifest.json](manifest.json).

## Legacy entry point

The repository root file [STYLE_GUIDE_JAVASCRIPT.md](../STYLE_GUIDE_JAVASCRIPT.md) is a short pointer into `guides/` (TypeScript-focused paths).
