# Style Guide — Python (client)

> **Browser or desktop UI written in Python** (e.g. Streamlit, Reflex, Gradio,
> PyScript, Qt with Python). This repo’s primary path is **TypeScript React** in
> `apps/web`; add depth here once you choose a Python UI stack.
>
> Until then, use this file as a **section map** aligned to
> [TypeScript (client)](../typescript/STYLE_GUIDE.md) so tooling and agents know
> where conventions will live.

Read [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) for
monorepo-wide TypeScript rules that may still apply to shared types or codegen
touching Python.

---

## Section map (TypeScript client → Python client)

| TypeScript client topic | Python client conventions (to standardize after stack choice) |
|-------------------------|----------------------------------------------------------------|
| **Testing → RTL / MSW** | Component or E2E strategy for chosen framework (e.g. Playwright for web UIs, framework-native test utils) |
| **React Component Conventions** | View/component boundaries, composition, props/state naming for your UI toolkit |
| **Styling** | CSS variables / design tokens vs framework styling; align with Tailwind token story if sharing design system |
| **State Management** | Local vs server-fetched state; equivalent to TanStack Query + Zustand split for your stack |

---

## Topics owned by TypeScript (monorepo) guide

Vitest **client** config, shared `packages/types`, and ESLint/Prettier are
covered under [monorepo/typescript/STYLE_GUIDE.md](../../monorepo/typescript/STYLE_GUIDE.md). Python
client packages should still follow **feature folders**, **co-located tests**,
and **no meaningless barrel files** — mirror the spirit of the TypeScript monorepo guide in
`pyproject.toml` / Ruff / pytest layout when you add them.

---

## Related guides

- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)
- [TypeScript (client)](../typescript/STYLE_GUIDE.md)
- [Python (server)](../../server/python/STYLE_GUIDE.md)
