# Style Guide — Python (server)

> **HTTP APIs, workers, and data access in a polyglot monorepo.** When this repo
> ships Python next to the TypeScript stack, align **cross-cutting policies**
> (shared types contracts, env validation, structured logs, error responses) with
> the TypeScript server guide where it makes sense.
>
> Read [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) for
> pnpm/Turborepo/workspace layout. Python packages should plug into the same
> task graph and folder discipline (`apps/`, `packages/`) as you define them.

This document is a **section map**: each row names the topic in
[TypeScript (server)](../typescript/STYLE_GUIDE.md) and the **Python analogue**
to standardize when you author the full guide.

---

## Section map (TypeScript server → Python server)

| TypeScript server topic | Python server conventions (to standardize) |
|-------------------------|---------------------------------------------|
| **Framework** | Async framework (e.g. FastAPI, Starlette) or sync (Flask); version pin in `pyproject.toml` / lockfile |
| **App assembly** | Application factory vs `if __name__ == "__main__"`; ASGI `app` importable for tests (mirror `app.ts` / `index.ts` split) |
| **Routing** | Routers / blueprints / `APIRouter` per domain; mount prefixes match API design |
| **Controllers** | Thin route handlers → services; dependency injection (FastAPI `Depends`) or explicit factories |
| **Middleware** | CORS, request ID, body size limits; JSON parsing per-router or via framework defaults |
| **Logging** | Structured JSON logging (e.g. `structlog`, `logging` + JSON formatter); **same semantics** as Pino table in TypeScript server guide |
| **Error handling** | Single exception handler; operational vs unexpected errors; HTTP status mapping |
| **Custom error classes** | Exception hierarchy or typed errors; align with shared API error shape consumed by TS client |
| **Zod validation errors** | Pydantic (or similar) at request boundary; map validation failures to same HTTP contract as `ValidationError` |
| **Environment configuration** | `pydantic-settings` (or equivalent) at startup; no raw `os.environ` scattered in handlers |
| **Database** | SQLAlchemy 2.x + Alembic (or chosen ORM); Postgres prod / SQLite tests — mirror Knex story |

---

## Topics owned by TypeScript (monorepo) guide (do not duplicate)

These live in [monorepo/typescript/STYLE_GUIDE.md](../../monorepo/typescript/STYLE_GUIDE.md) until extracted to language-agnostic foundations:

- TypeScript-specific module and compiler rules (Python uses import layout and `pyproject` / `src` layout instead).
- ESLint / Prettier / VS Code (replace with Ruff, formatter, editor settings).
- Vitest file naming and co-location (replace with **pytest** conventions: `test_*.py` or mirror `*.test.ts` policy in docs).
- Turborepo / pnpm (polyglot tasks still orchestrate Python `test` / `lint` targets).

---

## Full-stack monorepo checklist (Python service)

When adding `apps/<python-api>` or `packages/<py-lib>`:

1. Register the package in the workspace task runner so `turbo run test` (or equivalent) invokes pytest.
2. Keep **domain DTOs** compatible with `@battleship/types` / OpenAPI — either generate from schema or maintain parallel Pydantic models with clear ownership.
3. Use the same **log field names** and **correlation/request IDs** as the Node API for observability.

---

## Related guides

- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md)
- [TypeScript (server)](../typescript/STYLE_GUIDE.md)
- [Python (client)](../../client/python/STYLE_GUIDE.md)
