# Style Guide — TypeScript (monorepo)

> Applies to **all** TypeScript packages in the full-stack monorepo
> (`apps/api`, `apps/web`, `packages/*`). Source is `.ts` / `.tsx` on **Node.js**
> with ESM. For server-only or client-only rules, read the companion guides linked
> at the end.

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
- [Monorepo Tooling](#monorepo-tooling)
- [File and Folder Structure](#file-and-folder-structure)
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

### Monorepo package resolution

- **Source-export-via-aliases is the default** for monorepo packages consumed only
  within the repo. If a package needs external publication, add a build step with
  `emitDeclarationOnly` at that point. The decision is scoped to the individual
  package.

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

- **Shared types live in `packages/types` (`@battleship/types`)** — exports
  interfaces, Zod schemas, and custom error classes shared between `apps/api`
  and any future client package.

  ```
  packages/
    types/
      src/
        game.ts     # GameState, Player, Ship interfaces
        api.ts      # Request/response shapes
        errors.ts   # AppError base class + standard error classes
  ```

  Zod schemas and error classes live here alongside the interfaces so that
  both server and client share the same structures. This is the single source
  of truth for all shared data structures.

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
## Monorepo Tooling

### Package Manager

- **pnpm** with workspace configuration via `pnpm-workspace.yaml`.

### Task Orchestration

- **Turborepo** handles task-level caching, parallelism, and dependency ordering.

- **Root test script delegates to Turborepo:**

  ```jsonc
  // package.json (root)
  {
    "scripts": {
      "test": "turbo run test"
    }
  }
  ```

- **Configure the `test` task with dependency ordering and caching:**

  ```jsonc
  // turbo.json
  {
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "*.config.ts"],
      "outputs": ["coverage/**"]
    }
  }
  ```

  The `dependsOn: ["^build"]` ensures tests run only after upstream packages
  have built their `dist/` output. `outputs` enables cache hits on re-runs.
  Types-only packages consumed via source exports do not require a `build` task;
  `dependsOn: ["^build"]` skips workspace dependencies that define no `build`
  script.

---

## File and Folder Structure

```
project-root/
├── apps/
│   ├── api/               # @battleship/api — Node server
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── app.ts
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── knexfile.ts
│   │       ├── types.ts             # package-scoped type extensions
│   │       ├── vitest.setup.ts
│   │       ├── game/
│   │       │   ├── gameRouter.ts
│   │       │   ├── gameController.ts
│   │       │   ├── gameState.ts
│   │       │   ├── gameState.test.ts  # co-located tests
│   │       │   └── services/
│   │       ├── common/
│   │       └── db/
│   └── web/               # @battleship/web — React client
│       ├── vitest.config.ts
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── index.css            # theme tokens, resets
│           ├── types.ts             # package-scoped type extensions
│           ├── lib/
│           │   └── utils.ts         # cn() helper
│           ├── components/
│           │   ├── ui/              # shadcn/ui primitives
│           │   └── game/            # feature components
│           ├── hooks/               # shared hooks only
│           └── mocks/               # MSW handlers
├── packages/
│   ├── util/              # @battleship/util — logger, error handler, middleware
│   │   └── src/
│   │       ├── logger.ts
│   │       └── errorHandler.ts
│   ├── types/             # @battleship/types — shared types, Zod schemas, errors
│   │   └── src/
│   │       ├── game.ts
│   │       ├── api.ts
│   │       └── errors.ts
│   ├── tsconfig/          # @battleship/tsconfig — shared TS config
│   └── eslint-config/     # shared ESLint config
├── turbo.json
├── pnpm-workspace.yaml
├── eslint.config.js
└── .prettierrc
```

### Conventions

- **Feature-based organisation** within `src/`: one folder per domain, with
  `services/` subfolder for business logic.
- **No barrel (`index.ts`) export files.** Import directly from the source file.
- **Config files live inside `src/`** alongside source code, with the exception
  of `vitest.config.ts` which lives at the package root (Vitest convention).
- **Test files are co-located** with the modules they test.


---

## Related guides

- **Server (TypeScript)** — [server/typescript/STYLE_GUIDE.md](../../server/typescript/STYLE_GUIDE.md)
- **Client (TypeScript)** — [client/typescript/STYLE_GUIDE.md](../../client/typescript/STYLE_GUIDE.md)
- **Server (Python)** — [server/python/STYLE_GUIDE.md](../../server/python/STYLE_GUIDE.md)
- **Client (Python)** — [client/python/STYLE_GUIDE.md](../../client/python/STYLE_GUIDE.md)

