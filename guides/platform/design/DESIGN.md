# Design system — product and UX foundation

> **Scope:** High-level product and user-experience rules for new applications. Pair this file with
> [components.md](components.md) for Shadcn UI–style building blocks, and the TypeScript client style guide
> for implementation detail.

## Principles

- **One source of token truth.** Define color, space, type scale, and motion in CSS custom properties
  (for example in a small number of base stylesheets) so theming, dark mode, and density stay coherent.
- **Progressive disclosure.** Prefer simple defaults in the product surface; hide advanced or dangerous
  actions behind explicit steps or confirm dialogs, not long forms on first load.
- **Content before chrome.** Favor scannable structure (headings, short paragraphs, clear calls to action)
  over decorative elements that do not help the user complete a task.
- **Respect the stack.** This repository assumes React, Tailwind, and composition-first component libraries
  (for example [Shadcn UI](https://ui.shadcn.com/)) when you document UI patterns. Copy components into
  `components/ui` (or the path your app chose) and treat that directory as **owned** source, not a black
  box you cannot change.

## Brand and copy

- Use the voice and tone your product’s specification defines; the dotfiles repository does not mandate
  marketing language. In internal tools, keep labels short, use sentence case for buttons where possible,
  and avoid internal codenames in user-facing strings unless the spec requires them.

## When to add a local primitive

Add or extend a design-system component when the same pattern appears in three or more places, or when
a pattern carries accessibility or state semantics you must not duplicate by hand. For one-off marketing
layouts, local components next to the feature are enough.

## Related

- [components.md](components.md) — Shadcn-style components and composition
- [TypeScript (client)](../../client/typescript/STYLE_GUIDE.md) — React, Tailwind, tests
- [A11Y](../../validation/A11Y.md) — what “done” means for accessible UI (validated in app repos; see
  that document for the checklist to wire into your CI)
