# Style Guide — TypeScript (server)

<!-- quickref
framework: express 5.x
node-version: 22
logger: pino
validation: zod
database: knex (postgresql / sqlite3)
error-handling: centralized middleware
env-config: zod-validated process.env
-->

> **`apps/api` and Node HTTP services.** Read
> [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) first — it
> covers ESM, `tsconfig`, ESLint/Prettier, Vitest basics, pnpm, Turborepo, and the
> repository tree.

---

## Scope (one API, one stack)

- **Mutual exclusivity:** For a **given HTTP API** (one public service boundary),
  treat **either** this guide **or**
  [Python (server)](../python/STYLE_GUIDE.md) as the **implementation**
  authority — not both at once for the **same** routes. If you intentionally
  split traffic (gateway, BFF, strangler), document that architecture separately;
  each hop still picks **one** language’s server guide for its own code.
- **This document** is the **standalone** convention set for **Node.js 22 +
  Express 5.x** APIs. It does not assume you read the Python server guide.
- **Polyglot repository:** Other services may be written in Python; **HTTP
  contracts** across languages follow the **OpenAPI** rules in
  [Python (monorepo) — OpenAPI](../../monorepo/python/STYLE_GUIDE.md#openapi-as-single-source-of-truth)
  when the spec is the shared artifact. **Zod-at-boundaries** below applies to
  **this** Express app’s own request handlers only.

---

## Table of Contents

- [Scope (one API, one stack)](#scope-one-api-one-stack)
- [Testing (server packages)](#testing-server-packages)
- [Node / Server Conventions](#node--server-conventions)

---

## Testing (server packages)

Use the **server** Vitest configuration from
[Testing → Test Runner](../../monorepo/typescript/STYLE_GUIDE.md#test-runner)
(`environment: 'node'`, `setupFiles` for DB if applicable).

[Testing → Test File Conventions](../../monorepo/typescript/STYLE_GUIDE.md#test-file-conventions)
and
[Testing → Test Infrastructure](../../monorepo/typescript/STYLE_GUIDE.md#test-infrastructure)
(Knex, PostgreSQL / SQLite) apply directly to API packages.

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
- Request logging middleware from `@<project>/util` applied globally.
- `errorHandler` is registered **last** in `app.ts` (see [Error Handling](#error-handling)).

### Logging

- **Pino is the standard logger.** All application logging uses Pino via
  a thin wrapper in `@<project>/util`. Do not use `console.log` in
  application code.

- The wrapper centralizes Pino instantiation and default context. App code
  gets a real Pino logger instance back:

  ```ts
  // @<project>/util — createLogger wrapper
  import pino from 'pino';

  export const createLogger = (context: { module: string; level?: string }) => {
    const { level = 'info', ...childContext } = context;
    return pino({ level }).child(childContext);
  };
  ```

  ```ts
  // Usage in application code
  import { createLogger } from '@<project>/util';
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

- Custom error classes live in `@<project>/types` and extend a base
  `AppError` class. Each error carries a `statusCode` that the error
  handler uses to set the HTTP response:

  ```ts
  // @<project>/types — errors.ts
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

- A single error-handling middleware in `@<project>/util` handles all errors.
  It is registered **last** in `app.ts`:

  ```ts
  // @<project>/util — errorHandler.ts
  import { AppError } from '@<project>/types';
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
  import { errorHandler } from '@<project>/util';

  // ... routes mounted above
  app.use(errorHandler); // must be last
  ```

#### Zod Validation Errors

- When Zod validation fails at an API boundary, wrap the error in a
  `ValidationError` so it flows through the same error handler:

  ```ts
  import { ValidationError } from '@<project>/types';

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

## Related guides

- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)
- [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md) — OpenAPI SSOT and
  Python tooling when the repo also ships FastAPI services
- [Python (server)](../python/STYLE_GUIDE.md) — **alternative** stack for
  Python-backed APIs (not combined with this guide for the same surface)
- [TypeScript (client)](../../client/typescript/STYLE_GUIDE.md)

---
