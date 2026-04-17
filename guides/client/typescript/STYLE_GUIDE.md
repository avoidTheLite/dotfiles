# Style Guide — TypeScript (client)

<!-- quickref
framework: react 19
bundler: vite 6
styling: tailwindcss 4
component-library: shadcn/ui
state-server: tanstack-query
state-client: zustand
testing: vitest + react-testing-library + msw
class-utility: clsx + tailwind-merge + cva
-->

> **`apps/web` and browser React packages.** Read
> [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) first — it
> covers ESM, `tsconfig`, ESLint/Prettier, Vitest, pnpm, Turborepo, and shared
> types (shared `packages/types`).

---

## Table of Contents

- [Testing](#testing)
- [React Component Conventions](#react-component-conventions)
- [Styling](#styling)
- [State Management](#state-management)

---

## Testing

### Client Testing (RTL and MSW)

- **Use React Testing Library (RTL) for component tests.** RTL encourages
  testing from the user's perspective — what is rendered, what can be clicked —
  rather than implementation details.

  ```tsx
  import { render, screen } from '@testing-library/react';
  import App from './App';

  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
  ```

- **Use MSW 2.x for API mocking in client tests.** MSW intercepts
  fetch/XHR at the network layer so components are tested against realistic
  API shapes without a live server.

  ```ts
  // src/mocks/handlers.ts
  import { http, HttpResponse } from 'msw';

  export const handlers = [
    http.get('/game/:id', () => {
      return HttpResponse.json({ id: '1', status: 'active' });
    }),
  ];
  ```

---

## React Component Conventions

### Component Definition

- **Functional components only** — no class components.
- **Arrow function syntax** with destructured props:

  ```tsx
  const NewGameButton = ({ newGame }: NewGameButtonProps) => {
    return <button onClick={newGame}>New Game</button>;
  };
  ```

- No `React.FC<Props>` type annotation — type props via the arrow function
  parameter. Exported components use `React.JSX.Element` (or
  `React.JSX.Element | null`) as their explicit return type per the
  [General TypeScript Rules](#general-typescript-rules).
- `App.tsx` should be intentionally thin — render top-level feature components
  and delegate all logic to feature folders.
- Use fragments (`<>...</>`) to avoid unnecessary wrapper elements.

### Prop Typing

- **Name prop interfaces with a `Props` suffix:**

  ```ts
  // ✗ Avoid — name collision with the component
  interface NewGameButton {
    newGame: () => void;
  }

  // ✓ Preferred
  interface NewGameButtonProps {
    newGame: () => void;
  }
  ```

### Hook Co-location

- **Co-locate hooks with the components that own them.** Only promote hooks
  to a shared `hooks/` directory when they are used by multiple unrelated features.

  ```
  src/
    game/
      GameBoard.tsx
      useGameState.ts   ← co-located with its consumer
    hooks/              ← only truly shared hooks
  ```

---

## Styling

### Core System

Tailwind CSS is the sole styling system. Do not use styled-components, CSS
modules, or CSS-in-JS solutions.

Tailwind is integrated via the Vite plugin (`@tailwindcss/vite`) — no separate
`tailwind.config.js` is needed unless the project adopts shadcn/ui, which
generates a `tailwind.config.ts` to map CSS custom properties to semantic
utility classes.

### Theming

Theming uses **CSS custom properties with HSL values**, not hardcoded Tailwind
color classes. This enables dark mode, brand theming, and component library
compatibility through a single mechanism.

Define theme tokens in the global stylesheet as HSL channels (without the
`hsl()` wrapper) so Tailwind can apply opacity modifiers:

```css
/* index.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    /* ... remaining dark overrides */
  }
}
```

Dark mode is toggled by adding the `dark` class to the root element. Reference
tokens in components via `hsl(var(--token))`:

```tsx
// In CVA variant definitions or direct Tailwind usage
'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
```

If the project uses shadcn/ui (see below), its Tailwind config maps these
tokens to semantic utility classes (`bg-primary`, `text-muted-foreground`,
etc.), eliminating the need for the `hsl(var(...))` syntax in component code.
Prefer the short-form classes when the mapping is available.

### Component Library — shadcn/ui

**shadcn/ui is the standard component library for UI primitives.** It provides
pre-built, accessible components built on Radix UI + Tailwind + CVA — the same
stack this guide specifies. Components are copied into the project as source
files, not installed as an npm dependency.

shadcn components live in the client app's component directory:

```
apps/web/
  src/
    components/
      ui/           ← shadcn primitives (Button, Dialog, Input, etc.)
      game/         ← feature components
```

**Agent conventions for shadcn/ui:**

- Use the shadcn CLI (`npx shadcn@latest add <component>`) to pull components.
- After pulling, normalize the component to match project conventions: verify
  import paths, confirm the `cn()` helper location, and ensure the component
  uses the project's CSS custom property tokens.
- When upstream shadcn updates are available, diff and merge rather than
  re-pulling. Review changes against project customizations before applying.
- If a needed component is not available in shadcn, build it following the
  same patterns: Radix primitive + CVA variants + `cn()` for class merging.

### Utility Stack

The styling utility stack consists of three packages:

- `clsx` — conditional class assembly
- `tailwind-merge` — Tailwind-aware class conflict resolution
- `class-variance-authority` (CVA) — variant-driven component styling

All three are combined through a single `cn()` helper. Every component must
use `cn()` for class composition — never call `clsx` or `twMerge` directly
in component code:

```ts
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

> **Note:** shadcn/ui ships with this exact helper. If using shadcn, it will
> generate this file during initialization. Confirm the file location matches
> the project's import alias configuration.

### Component Styling with CVA

Use CVA to define variant-driven components with predefined sets of Tailwind
classes. This is the primary mechanism for reusable, consistent component
styling. Reference CSS custom property tokens in variant definitions:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonStyles = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        primary:
          'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90',
        secondary:
          'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80',
        ghost:
          'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
        destructive:
          'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive))]/90',
      },
      size: {
        sm: 'text-sm px-3 py-1.5',
        md: 'text-base px-4 py-2',
        lg: 'text-lg px-6 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);
```

> **Note:** If the project uses shadcn/ui with its Tailwind config mapping,
> prefer the short-form utility classes (`bg-primary`,
> `text-destructive-foreground`) over the raw `hsl(var(...))` syntax. The
> example above shows the raw form for projects without that mapping.

Every CVA component must accept and merge an external `className` prop so
consumers can apply overrides safely:

```tsx
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>;

const Button = ({ variant, size, className, ...props }: ButtonProps) => (
  <button
    className={cn(buttonStyles({ variant, size }), className)}
    {...props}
  />
);
```

#### CVA Scope

CVA is appropriate for leaf and atomic components with discrete visual
variants — buttons, badges, inputs, alerts, and similar. Compound components
(cards with headers, modals with multiple sections) should compose CVA
primitives using plain Tailwind for layout, not attempt to express parent-child
variant relationships through a single CVA definition.

### Global Stylesheets

Global stylesheets (`index.css`) are permitted for the following purposes only:

- **CSS reset and normalization.** `box-sizing`, margin resets, font smoothing,
  and similar browser consistency rules.
- **`@font-face` declarations.** Self-hosted font loading. Reference the font
  family through Tailwind theme configuration after declaring it here.
- **Tailwind `@layer base` directives.** Default element-level styles and CSS
  custom property theme tokens (see Theming above).
- **CSS custom properties that Tailwind cannot express.** For example, variables
  consumed by a third-party library. These require an explicit comment
  explaining why a Tailwind theme extension was insufficient.

The following are **not permitted** in global stylesheets: component-specific
styles, animation `@keyframes` (use Tailwind theme extensions), utility
classes, media queries, or anything scoped to a specific component or feature.

### Escalation Rule

If a styling need arises that does not fit within this system — it cannot be
solved with Tailwind utilities, theme extensions, CVA variants, or the global
stylesheet allowlist — do not silently work around it. Flag it to the developer
with a description of the constraint and the options considered before
proceeding.

---

## State Management

### Principles

- **Local state is the default.** Use `useState` for state that is read and
  written within the same component or passed to a direct child. Reach for
  shared state management when a second unrelated component needs the same
  state, or when a prop passes through a component that does not use it.

### Server State — TanStack Query

- **TanStack Query manages all server-originated data.** Any state that is
  fetched from, synchronized with, or mutated on the API is server state.
  TanStack Query handles caching, refetching, deduplication, and
  loading/error states so components do not manage this manually.

- Do not use `useEffect` + `useState` for API data fetching. This is the
  pattern TanStack Query replaces:

  ```tsx
  // ✗ Avoid — manual fetch with useEffect
  const [game, setGame] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(`/game/${id}`)
      .then((res) => res.json())
      .then(setGame)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [id]);

  // ✓ Preferred — TanStack Query
  const { data: game, isLoading, error } = useQuery({
    queryKey: ['game', id],
    queryFn: () => fetch(`/game/${id}`).then((res) => res.json()),
  });
  ```

- **Mutations use `useMutation`** with cache invalidation to keep the UI
  in sync with the server after writes.

### Client State — Zustand

- **Zustand manages client-side state shared across unrelated components.**
  This includes UI state that multiple components need but that does not
  originate from the server — active selections, modal visibility driven
  by non-parent components, user preferences, or transient interaction state.

- Stores are **small and domain-scoped.** Do not create a single global store.
  Each store owns one logical slice of state:

  ```ts
  // stores/useGameUIStore.ts
  import { create } from 'zustand';

  interface GameUIState {
    selectedCell: { x: number; y: number } | null;
    selectCell: (cell: { x: number; y: number }) => void;
    clearSelection: () => void;
  }

  export const useGameUIStore = create<GameUIState>((set) => ({
    selectedCell: null,
    selectCell: (cell) => set({ selectedCell: cell }),
    clearSelection: () => set({ selectedCell: null }),
  }));
  ```

- **Components subscribe to slices, not the whole store.** Use selectors to
  avoid unnecessary re-renders:

  ```tsx
  // ✓ Preferred — subscribes only to selectedCell
  const selectedCell = useGameUIStore((state) => state.selectedCell);

  // ✗ Avoid — subscribes to entire store, re-renders on any change
  const store = useGameUIStore();
  ```

- Store files live alongside the feature that owns them. Only promote to a
  shared `stores/` directory when the store is consumed by multiple unrelated
  features. This follows the same co-location principle as hooks.

### Choosing the Right Tool

| Situation | Tool |
|-----------|------|
| State used by a single component | `useState` |
| State passed to a direct child | Props |
| Data fetched from the API | TanStack Query |
| Client state shared across unrelated components | Zustand |
| Transient form state | `useState` or a form library |

If a state management need arises that does not fit these categories, flag it
to the developer rather than introducing a new library.
