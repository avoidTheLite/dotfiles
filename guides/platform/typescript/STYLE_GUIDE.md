# Style Guide — TypeScript (platform)

> Applies to **all** TypeScript on **Node.js** in this ecosystem: `.ts` / `.tsx`, **ESM**, whether the
> project is a **single package** or part of a **pnpm + Turborepo monorepo**. This document is the **language
> and tooling baseline** (compiler, ESLint, Prettier, Vitest, Zod, types).
>
> **Workspace-only** rules — `pnpm` workspaces, Turborepo task graph, `apps/` and `packages/` layout, and how
> internal packages wire together — live in **[TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)**.
> Read that guide **in addition** to this one when you maintain a monorepo. For server-only or client-only
> rules, read the companion guides linked at the end.

---

## Table of Contents

- [Environment Baseline](#environment-baseline)
- [Module System](#module-system)
- [TypeScript Conventions](#typescript-conventions)
- [Formatting and Linting](#formatting-and-linting)
- [Editor Settings (VS Code / Cursor)](#editor-settings-vs-code--cursor)
- [Testing](#testing)
  - [Test Runner](#test-runner)
  - [Test File Conventions](#test-file-conventions)
  - [Test Infrastructure](#test-infrastructure)
- [Layout within a package](#layout-within-a-package)
- [Related guides](#related-guides)

---

## Environment Baseline

- **Node.js 22** is the required runtime baseline for local development, CI, and
  Dev Containers.

---

## Module System

- The monorepo is **fully ESM**. All packages declare `"type": "module"`.
- The shared base tsconfig enforces `module: NodeNext` / `moduleResolution: nodenext`.
- All relative imports **must include the `.ts` file extension**:

  ```ts
  import config from './config.ts';
  import gameRouter from './game/gameRouter.ts';
  ```

  This is required by Node's `NodeNext` resolver. Developers coming from
  bundler-mode projects should expect this.

- **Use `node:` protocol imports for all Node built-in modules.** The
  prefix explicitly identifies a built-in, prevents shadowing by npm packages
  with the same name, and is the modern Node.js convention.

  ```ts
  // ✗ Avoid
  import path from 'path';

  // ✓ Preferred
  import path from 'node:path';
  ```

- **Internal monorepo packages** resolve through **TypeScript path aliases** to
  source files. This is the default resolution strategy for packages not published
  externally.

---

## TypeScript Conventions

### Compiler Configuration

- `packages/tsconfig/base.json` is the **single source of truth**. Individual
  packages extend it and add only their own `outDir`/`rootDir`.
- Notable base settings:
  - `target: ES2022`
  - `module: NodeNext` / `moduleResolution: nodenext`
  - `composite: true`, `declaration: true`, `declarationMap: true`, `sourceMap: true`
  - `isolatedModules: true`
  - `emitDeclarationOnly: true` — tsc produces `.d.ts` files for shared
    packages but does not emit JavaScript (bundlers or the runtime handle that).
    App packages that nothing imports from may override to `noEmit: true`, as may
    types-only shared packages consumed within the monorepo via source exports
    (for example `@battleship/types`).
  - `allowImportingTsExtensions: true`
  - `jsx: react-jsx` — set in base for forward compatibility

- **`strict: true` is enabled in the shared base tsconfig.** This enables
  `strictNullChecks`, `noImplicitAny`, and related checks that catch entire
  categories of runtime bugs at compile time.

  ```jsonc
  // packages/tsconfig/base.json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "strict": true,
      "emitDeclarationOnly": true
      // ... rest of existing options
    }
  }
  ```

### Package boundaries and exports

- **Source-export-via-aliases** (or project references) is the default for first-party packages consumed only
  within a workspace. If a package needs **external** publication, add an explicit `build` step with
  `emitDeclarationOnly` (or your bundler) at that point. The decision is scoped to the **individual
  package** — see also [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) for how that fits
  `turbo.json` and `dependsOn`.

### General TypeScript Rules

- All source files are `.ts` or `.tsx`. No `.js` files.
- **Type location follows a three-tier rule** (see also
  [Shared Types Package](#shared-types-package)):

  - **Domain types live in `@battleship/types`.** Interfaces representing
    domain entities, API request/response shapes, and Zod schemas belong in
    the shared types package regardless of how many files currently import
    them.
  - **Package-scoped types live in `src/types.ts`.** Types that extend or
    specialize domain types for a single package's needs — but are shared
    across multiple files within that package — belong in a single `types.ts`
    file at the package's `src/` root. This file must import and extend from
    `@battleship/types`, not redefine domain shapes.
  - **Implementation-private types stay inline.** Component state shapes,
    local helper parameters, and types used only within a single module are
    declared close to their point of use.

  No `types/` directories within individual packages.

- Use `import type` for type-only imports:

  ```ts
  import type { Express } from 'express';
  ```

- **Named exports for all project code.** Default exports are used only when
  required by an external API's contract (e.g., `React.lazy`). When importing
  external libraries, use whatever export style the library provides.

- **Explicit return types on all exported functions; infer everywhere else.**
  Exported functions are package contracts — an explicit return type makes the
  contract visible, produces better error messages at call sites, and prevents
  accidental API changes from propagating silently. Internal functions benefit
  from inference, which keeps types narrower and reduces annotation noise.
  This applies uniformly to utility functions, hooks, components, and any
  other exported constant that is a function.

  ```ts
  // Exported — explicit return type (package contract)
  export const createLogger = (context: { module: string }): pino.Logger => {
    return pino().child(context);
  };

  // Internal — inferred return type
  const formatContext = (module: string) => {
    return { module, timestamp: Date.now() };
  };
  ```

- **Use Zod for runtime validation at API boundaries.** TypeScript types
  are erased at runtime. Request bodies must be validated before use. Zod
  parses and validates in one step and infers the TypeScript type from the
  schema.

  ```ts
  import { z } from 'zod';
  import { ValidationError } from '@battleship/types';

  const DeployBody = z.object({
    positions: z.array(z.object({ x: z.number(), y: z.number() })),
  });

  type DeployBodyType = z.infer<typeof DeployBody>;

  gameRouter.patch('/:id/deploy', (req, res) => {
    const result = DeployBody.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.message);
    // result.data is now validated and correctly typed
    gameControllerInstance.deploy(req, res);
  });
  ```

### Shared Types Package

- **Shared types** usually live in a dedicated workspace package, for example `packages/types`
  (`@battleship/types`), exported as interfaces, Zod schemas, and custom error classes shared between
  server and client apps. In a **single app** without a `packages/` tree, use one shared module (for
  example `src/shared/types/`) and the same **three-tier** type rule below.

  ```
  packages/
    types/
      src/
        game.ts
        api.ts
        errors.ts
  ```

  Zod schemas and error classes live here alongside the interfaces so consumers share the same
  structures. That package (or module) is the **single source of truth** for cross-cutting data shapes
  when the product spans multiple entrypoints.

---

## Formatting and Linting

### ESLint

- A shared `packages/eslint-config` package provides the base ESLint configuration.
- **Use ESLint flat config (`eslint.config.js`).** The legacy `.eslintrc` format
  is deprecated as of ESLint 9.
- Canonical plugin/config stack for the shared base config:
  - `@eslint/js`
  - `typescript-eslint`
  - `eslint-plugin-import`
  - `eslint-plugin-n`
  - `eslint-config-prettier`

  ```js
  // eslint.config.js
  import battleshipConfig from '@battleship/eslint-config';
  export default [...battleshipConfig];
  ```

### Prettier

- **Prettier handles all formatting.** Consistent formatting eliminates style
  debates in code review. Integrate via `eslint-config-prettier` (disables
  conflicting ESLint rules) and run as a pre-commit hook via `lint-staged`.

  ```jsonc
  // .prettierrc
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2
  }
  ```

---

## Editor Settings (VS Code / Cursor)

- VS Code and Cursor should use identical settings.
- `editor.defaultFormatter`: `esbenp.prettier-vscode`
- `editor.formatOnSave`: `true`
- `editor.codeActionsOnSave.source.fixAll.eslint`: `"explicit"`
- `eslint.useFlatConfig`: `true`
- `editor.tabSize`: `2`
- `editor.insertSpaces`: `true`

---

## Testing

### Test Runner

- **Vitest is the standard test runner for all packages.** Vitest is
  ESM-native, Vite-native, and eliminates the ts-jest transform layer and
  ESM/CJS/NodeNext compatibility issues that plague Jest in ESM projects.

  **Server packages:**

  ```ts
  // vitest.config.ts
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: {
      environment: 'node',
      globals: true,
      setupFiles: ['./src/vitest.setup.ts'],
    },
  });
  ```

  **Client packages:**

  ```ts
  // vitest.config.ts
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
    },
  });
  ```

### Test File Conventions

- Test files are **co-located** with the source files they test.
- Naming: `*.test.ts` for unit tests, `*.integration.test.ts` for integration tests.
- Tests run with `--runInBand` (sequential) when they share DB state.

### Test Infrastructure

- Setup/teardown runs Knex DB migrations and seeds before all tests; destroys
  the connection after.
- Database: PostgreSQL in production; SQLite3 in test environment.

---

## Layout within a package

These conventions apply **inside** each TypeScript package’s `src/` (whether that package is `apps/api`,
`apps/web`, or a stand-alone `server/` tree without a monorepo).

- **Feature-based organisation:** one folder per domain, with a `services/` subfolder for business logic
  where that split helps.
- **No barrel (`index.ts`) export files** for internal code. Import directly from the source file.
- **Config** that is truly package-local (for example `config.ts`, `knexfile.ts` patterns) lives with the
  code as your template standardises; `vitest.config.ts` lives at the **package root** (Vitest convention).
- **Test files** stay **co-located** with the modules they test.

The **repository root** structure (`apps/`, `packages/`, `turbo.json`, `pnpm-workspace.yaml`) is defined in
[TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md).

---

## Related guides

- **TypeScript (monorepo)** — [monorepo/typescript/STYLE_GUIDE.md](../../monorepo/typescript/STYLE_GUIDE.md) —
  pnpm, Turborepo, workspace layout, task graph
- **Python (platform)** — [platform/python/STYLE_GUIDE.md](../python/STYLE_GUIDE.md) — Python baseline in the
  same stack
- **Python (monorepo)** — [monorepo/python/STYLE_GUIDE.md](../../monorepo/python/STYLE_GUIDE.md) — Python in a
  polyglot monorepo
- **Server (TypeScript)** — [server/typescript/STYLE_GUIDE.md](../../server/typescript/STYLE_GUIDE.md)
- **Client (TypeScript)** — [client/typescript/STYLE_GUIDE.md](../../client/typescript/STYLE_GUIDE.md)
- **Server (Python)** — [server/python/STYLE_GUIDE.md](../../server/python/STYLE_GUIDE.md)
- **Client (Python)** — [client/python/STYLE_GUIDE.md](../../client/python/STYLE_GUIDE.md)

