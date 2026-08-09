# Design system — components (Shadcn-style)

> **Scope:** Conventions for a **components/ui**-style layer built on Radix primitives and Tailwind, as
> popularized by [Shadcn UI](https://ui.shadcn.com/). This is a pattern guide; your app owns the code you
> copy in.

## Installation and ownership

- **Copy, don’t abstract prematurely.** The Shadcn workflow adds source files to your repository. Treat
  `components/ui` as a maintained layer: review upgrades like any other dependency change.
- **Pin compatible versions** of React, Radix, Tailwind, and `class-variance-authority` (or the styling
  approach your team chose) per your TypeScript monorepo guide. Avoid mixing two different dialog or menu
  primitives in the same surface without a strong reason.
- **Keep tokens in CSS variables** so the same components work in light and dark themes and in tests. Avoid
  hard-coded hex in components; reference semantic tokens (for example `hsl(var(--background))`).

## Composition

- Prefer **small, composable pieces** (trigger, content, item) over one monolithic `ComplexDialog` in shared
  code unless the product specification calls for a single fixed layout everywhere.
- **Do not** wrap every Shadcn component in a new abstraction the first time you use it. Introduce a
  project-level `AppButton` (or similar) when you need a fourth consistent variation or cross-cutting
  analytics attributes.

## Testing

- Use React Testing Library for behavior; storybook or visual regression is optional and decided per app. See
  the [TypeScript (client)](../../client/typescript/STYLE_GUIDE.md#testing) guide for RTL and MSW.

## Related

- [DESIGN.md](DESIGN.md) — product and UX foundation
- [A11Y](../../validation/A11Y.md) — accessibility bar and what to automate in your application CI
