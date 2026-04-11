# Style Guide — JavaScript

> Single source of truth for coding conventions. All new code must follow
> this guide. Existing code should be brought into compliance as it is touched.

---

## Table of Contents

- [Environment Baseline](#environment-baseline)
- [Module System](#module-system)
- [TypeScript Conventions](#typescript-conventions)
- [Formatting and Linting](#formatting-and-linting)
- [Editor Settings (VS Code / Cursor)](#editor-settings-vs-code--cursor)
- [Testing](#testing)
- [React Component Conventions](#react-component-conventions)
- [Styling](#styling)
- [State Management](#state-management)
- [Node / Server Conventions](#node--server-conventions)
- [Monorepo Tooling](#monorepo-tooling)
- [File and Folder Structure](#file-and-folder-structure)

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
    App packages that nothing imports from may override to `noEmit: true`.
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

### General TypeScript Rules

- All source files are `.ts` or `.tsx`. No `.js` files.
- Types are declared **inline, close to their point of use**. No separate
  `types/` directories unless the type is shared across packages (see
  Shared Types below).
- Use `import type` for type-only imports:

  ```ts
  import type { Express } from 'express';
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

### Client Testing

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

- **Default exports** for every component.
- No `React.FC<Props>` type annotation — type via the arrow function signature.
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

- **Tailwind CSS is the sole styling system.** Do not use styled-components
  or CSS modules.

- Use the **Tailwind + CVA pattern** for variant-driven components:

  ```tsx
  import { cva } from 'class-variance-authority';

  const button = cva('rounded px-4 py-2', {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white',
        ghost: 'bg-transparent border',
      },
    },
  });

  const Button = ({ variant, ...props }: ButtonProps) => (
    <button className={button({ variant })} {...props} />
  );
  ```

- Utility stack: `clsx`, `tailwind-merge`, `class-variance-authority`.
- Radix UI primitives for accessible base components.
- Tailwind is integrated via the Vite plugin (`@tailwindcss/vite`) — no
  separate `tailwind.config.js` needed.
- No CSS module files. Global stylesheets (`App.css`, `index.css`) for resets
  and base styles only.

---

## State Management

- Local React state (`useState`) is the default for component-level state.
- State lives in feature-level components.
- **No external state management library is standardized yet.** When a project
  outgrows local state (e.g., prop-drilling through 3+ levels, duplicating
  fetch logic across components), evaluate lightweight options like Zustand or
  Jotai and update this guide with the chosen standard.

> **TODO:** Evaluate and standardize a state management library when the need
> arises in a real project.

---

## Node / Server Conventions

### Framework

- **Express 5.x** on **Node.js 22**.

### App Assembly

- `app.ts` creates and exports the Express app.
- `index.ts` imports the app and calls `.listen()`.
- This separation makes the app importable in tests without starting a port.

### Routing

- One `*Router.ts` file per domain, created with `Router()` and exported.
- Mounted in `app.ts` under a path prefix:

  ```ts
  app.use('/game', gameRouter);
  ```

### Controllers

- Controllers are **factory functions** returning an object of handler methods:

  ```ts
  const gameControllerInstance = gameController();
  gameRouter.post('/new', gameControllerInstance.newGame);
  ```

### Middleware

- `bodyParser.json()` is applied **per-router**, not globally.
- `cors()` is applied globally in `app.ts`.
- Request logging middleware from `@battleship/util` applied globally.
- `errorHandler` is registered **last** in `app.ts` (see [Error Handling](#error-handling)).

### Logging

- **Pino is the standard logger.** All application logging uses Pino via
  a thin wrapper in `@battleship/util`. Do not use `console.log` in
  application code.

- The wrapper centralizes Pino instantiation and default context. App code
  gets a real Pino logger instance back:

  ```ts
  // @battleship/util — createLogger wrapper
  import pino from 'pino';

  export const createLogger = (context: { module: string; level?: string }) => {
    const { level = 'info', ...childContext } = context;
    return pino({ level }).child(childContext);
  };
  ```

  ```ts
  // Usage in application code
  import { createLogger } from '@battleship/util';
  import { env } from './config.ts';

  const logger = createLogger({ module: 'gameController', level: env.LOG_LEVEL });

  logger.info({ gameId }, 'game created');
  logger.warn({ playerId }, 'player attempted invalid move');
  logger.error({ err, gameId }, 'failed to persist game state');
  ```

- **All logs are structured JSON.** Pino outputs JSON by default, which is
  machine-readable and compatible with log aggregation tools (Grafana + Loki,
  ELK, Seq, etc.).

- **For human-readable output in local development**, pipe through `pino-pretty`.
  This is a presentation concern only — application code always outputs JSON:

  ```jsonc
  // package.json
  {
    "scripts": {
      "dev": "node src/index.ts | pino-pretty",
      "debug": "LOG_LEVEL=debug node src/index.ts | pino-pretty"
    }
  }
  ```

#### Log Levels

Pino's log levels, in order of severity:

| Level | Use for |
|-------|---------|
| `fatal` | App is about to crash — unrecoverable errors |
| `error` | Operation failed — request errors, failed writes, unexpected exceptions |
| `warn` | Something unexpected but recoverable — invalid input, deprecated usage |
| `info` | Normal operations worth recording — request completed, game created |
| `debug` | Diagnostic detail — intermediate state, branching decisions |
| `trace` | Fine-grained detail — full request/response bodies, loop iterations |

- The default log level is set via `env.LOG_LEVEL` (see
  [Environment Configuration](#environment-configuration)), defaulting to
  `info` if not specified.
- **Override via environment variable or npm script** for ad-hoc debugging
  without changing config:

  ```jsonc
  // package.json
  {
    "scripts": {
      "dev": "node src/index.ts | pino-pretty",
      "debug": "LOG_LEVEL=debug node src/index.ts | pino-pretty",
      "trace": "LOG_LEVEL=trace node src/index.ts | pino-pretty"
    }
  }
  ```

### Error Handling

- **Route handlers do not use try/catch.** Express 5 automatically forwards
  thrown errors and rejected promises from async handlers to the error-handling
  middleware. Route handlers should throw and let the centralized error handler
  deal with logging and response formatting:

  ```ts
  // ✗ Avoid — try/catch in every handler
  gameRouter.get('/:id', async (req, res, next) => {
    try {
      const game = await gameService.getById(req.params.id);
      if (!game) return res.status(404).json({ error: 'Not found' });
      res.json(game);
    } catch (err) {
      next(err);
    }
  });

  // ✓ Preferred — throw, let the error handler catch it
  gameRouter.get('/:id', async (req, res) => {
    const game = await gameService.getById(req.params.id);
    if (!game) throw new NotFoundError('Game not found');
    res.json(game);
  });
  ```

#### Custom Error Classes

- Custom error classes live in `@battleship/types` and extend a base
  `AppError` class. Each error carries a `statusCode` that the error
  handler uses to set the HTTP response:

  ```ts
  // @battleship/types — errors.ts
  export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }

  export class ValidationError extends AppError {
    constructor(message = 'Invalid request') {
      super(message, 400);
    }
  }

  export class AuthenticationError extends AppError {
    constructor(message = 'Not authenticated') {
      super(message, 401);
    }
  }

  export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
      super(message, 403);
    }
  }

  export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
      super(message, 404);
    }
  }
  ```

- The `isOperational` flag distinguishes expected errors (bad input, missing
  resource) from unexpected bugs (null reference, failed DB connection).
  Operational errors return their message to the client; non-operational
  errors return a generic "Internal Server Error."

#### Centralized Error Handler

- A single error-handling middleware in `@battleship/util` handles all errors.
  It is registered **last** in `app.ts`:

  ```ts
  // @battleship/util — errorHandler.ts
  import { AppError } from '@battleship/types';
  import { createLogger } from './logger.ts';

  const logger = createLogger({ module: 'errorHandler' });

  export const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
      // Operational error — log at warn level, return specific status
      logger.warn({ err, statusCode: err.statusCode, path: req.path }, err.message);
      return res.status(err.statusCode).json({ error: err.message });
    }

    // Unexpected error — log at error level, return generic 500
    logger.error({ err, path: req.path }, 'unhandled error');
    return res.status(500).json({ error: 'Internal Server Error' });
  };
  ```

  ```ts
  // app.ts
  import { errorHandler } from '@battleship/util';

  // ... routes mounted above
  app.use(errorHandler); // must be last
  ```

#### Zod Validation Errors

- When Zod validation fails at an API boundary, wrap the error in a
  `ValidationError` so it flows through the same error handler:

  ```ts
  import { ValidationError } from '@battleship/types';

  gameRouter.patch('/:id/deploy', (req, res) => {
    const result = DeployBody.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.message);
    // ... handle valid request
  });
  ```

### Environment Configuration

- **Validate environment variables at startup with Zod.** `process.env` values
  are always strings (or `undefined`). Without validation, missing or malformed
  variables cause silent bugs at runtime. Zod validates and coerces at startup
  so the app fails fast with a clear error.

- **dotenv loads variables; Zod validates them.** These are complementary —
  dotenv populates `process.env` from a `.env` file, then Zod parses and
  type-coerces immediately:

  ```ts
  // config.ts
  import 'dotenv/config';
  import { z } from 'zod';

  const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'production', 'test']),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
  });

  export const env = envSchema.parse(process.env);
  ```

- The exported `env` object is fully typed and safe to use throughout the
  application. Downstream code gets real types (`env.PORT` is a `number`,
  not a string). The `LOG_LEVEL` override from npm scripts
  (`LOG_LEVEL=debug node src/index.ts`) flows through this same validation.

- This replaces any ad-hoc `config.get()` or `process.env.PORT` access
  scattered through the codebase. Import `env` from `config.ts` instead:

  ```ts
  // ✗ Avoid
  const port = parseInt(process.env.PORT || '3000');

  // ✓ Preferred
  import { env } from './config.ts';
  app.listen(env.PORT);
  ```

### Database

- Knex with PostgreSQL in production; SQLite3 in test environment.
- Migrations and seeds managed via Knex CLI.

---

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

---

## File and Folder Structure

```
project-root/
├── apps/
│   └── api/               # @battleship/api — Node server
│       ├── vitest.config.ts
│       └── src/
│           ├── app.ts
│           ├── index.ts
│           ├── config.ts
│           ├── knexfile.ts
│           ├── vitest.setup.ts
│           ├── game/
│           │   ├── gameRouter.ts
│           │   ├── gameController.ts
│           │   ├── gameState.ts
│           │   ├── gameState.test.ts  # co-located tests
│           │   └── services/
│           ├── common/
│           └── db/
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

