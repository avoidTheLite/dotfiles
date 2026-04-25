# Style Guide — Python (client)

> **Browser or desktop UI written in Python** (e.g. Streamlit, Reflex, Gradio,
> PyScript, Qt with Python). This repo’s primary path is **TypeScript React** in
> `apps/web`; add depth here once you choose a Python UI stack.
>
> **Shared Python rules** (Python 3.13, uv, Ruff, Pyright strict, Pydantic at
> boundaries, pytest, OpenAPI where APIs are touched) live in
> [Python (platform)](../../platform/python/STYLE_GUIDE.md). Read that guide
> first. If the project uses **Turborepo** beside TypeScript, also read
> [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md) and
> [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md).
>
> Until this file is expanded, use it as a **section map** aligned to
> [TypeScript (client)](../typescript/STYLE_GUIDE.md) so tooling and agents know
> where conventions will live.

Read [TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md) and, in a
**workspace** repo, [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) for
shared types, codegen, and pnpm layout that may touch Python.

---

## Section map (TypeScript client → Python client)

| TypeScript client topic | Python client conventions (to standardize after stack choice) |
|-------------------------|----------------------------------------------------------------|
| **Testing → RTL / MSW** | Component or E2E strategy for chosen framework (e.g. Playwright for web UIs, framework-native test utils) |
| **React Component Conventions** | View/component boundaries, composition, props/state naming for your UI toolkit |
| **Styling** | CSS variables / design tokens vs framework styling; align with Tailwind token story if sharing design system |
| **State Management** | Local vs server-fetched state; equivalent to TanStack Query + Zustand split for your stack |

---

## Topics owned by Python (platform) guide

**uv**, **Ruff**, **Pyright strict**, **Pydantic** contract rules, **pytest** /
**pytest-cov** / **Hypothesis**, **OpenAPI** workflow, and **folder layout within a
package** are defined in [platform/python/STYLE_GUIDE.md](../../platform/python/STYLE_GUIDE.md). **Turbo
task wiring** for Python in a polyglot monorepo is in
[monorepo/python/STYLE_GUIDE.md](../../monorepo/python/STYLE_GUIDE.md). Do not duplicate them here.

## Topics owned by TypeScript (platform) / (monorepo) guides

Vitest **client** config, shared `packages/types`, and ESLint/Prettier are
covered under [TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md) and, for workspaces,
[TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md). Python
client packages should still follow **feature folders**, **co-located tests**,
and **no meaningless barrel files** — mirror the spirit of those guides in
`pyproject.toml` / Ruff / pytest layout when you add them.

---

## Related guides

- [Python (platform)](../../platform/python/STYLE_GUIDE.md)
- [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md) (polyglot Turbo)
- [TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md)
- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)
- [TypeScript (client)](../typescript/STYLE_GUIDE.md)
- [Python (server)](../../server/python/STYLE_GUIDE.md)
