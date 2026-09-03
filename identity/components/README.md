# Pre-configured Standard UI Components

This folder is a [shadcn registry](https://ui.shadcn.com/docs/registry). Primitives live in `ui/`. Molecular components (composed from those primitives) live in `molecules/`. A root [`registry.json`](../../registry.json) includes this catalog so GitHub installs can pin a commit:

```sh
npx shadcn@latest add avoidTheLite/dotfiles/standard-ui#<git-sha>
```

Validate the source registry with `npx shadcn@latest registry validate ./registry.json`.

## Included items

### Primitives (`ui/`)

- **`button`**: Variant-driven button primitive using Class Variance Authority (CVA).
- **`input`**: Styled text input.
- **`label`**: Label primitive supporting peer focus and disabled state, built on `@radix-ui/react-label`.
- **`checkbox`**: Accessible check control, built on `@radix-ui/react-checkbox`.
- **`dialog`**: Modal overlay and focus-trapped dialog, built on `@radix-ui/react-dialog`.
- **`dropdown-menu`**: Popover menu and items, built on `@radix-ui/react-dropdown-menu`.
- **`card`**: Composable layout container for sections, headers, descriptions, content, and footers.
- **`utils`**: The canonical `cn(...)` class-merging helper using `clsx` and `tailwind-merge`.

### Molecules (`molecules/`)

- **`field`**: Labeled input with optional description and error text.
- **`confirm-dialog`**: Confirmation dialog composed from Dialog and Button.
- **`empty-state`**: Empty-state card with an optional action button.

`standard-ui` installs every primitive and molecule.

## Installation

`dotfiles install` and `dotfiles install-components` run `npx shadcn add` against this registry (local clone, or `avoidTheLite/dotfiles/<item>#<sha>`). Turbo generators copied into a project use the same registry. Do not copy these source files by hand.

```sh
dotfiles install-components
dotfiles install-components ./apps/web
```

After install, primitives land in `src/components/ui/` and molecules in `src/components/molecules/`. Keep copies up to date with `dotfiles sync-components`, which re-runs the shadcn install. See the root [README](../../README.md).
