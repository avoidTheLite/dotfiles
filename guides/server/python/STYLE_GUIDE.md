# Style Guide — Python (server)

> **HTTP APIs, workers, and data access** implemented in **Python** (FastAPI by
> default). This guide is **standalone** for that stack: you can implement and
> review a Python service using **this file plus**
> [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md) only.
>
> **Mutual exclusivity:** For a **given HTTP API** (one service boundary that
> clients call), choose **either** the Python server conventions **or** the
> [TypeScript (server)](../typescript/STYLE_GUIDE.md) conventions — not both as
> co-equal implementation guides for the **same** routes. Splitting the same
> public surface across two stacks requires an explicit gateway or BFF
> architecture, which you document outside these guides.
>
> **Shared Python tooling** (Python 3.13, uv, Ruff, Pyright strict, Pydantic at
> boundaries, OpenAPI SSOT, pytest, Turborepo) lives in
> [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md). Read it first for
> every Python package.

---

## Table of Contents

- [Framework](#framework)
- [App assembly](#app-assembly)
- [Routing](#routing)
- [Controllers and services](#controllers-and-services)
- [Middleware](#middleware)
- [Logging](#logging)
- [Error handling](#error-handling)
- [Request validation](#request-validation)
- [Environment configuration](#environment-configuration)
- [Database](#database)
- [Polyglot monorepo checklist](#polyglot-monorepo-checklist)
- [Related guides](#related-guides)

---

## Framework

- **FastAPI** (async-first) is the default HTTP framework unless a project
  documents a narrow exception.
- Pin the framework and runtime dependencies in **`pyproject.toml`** and the
  repo **lockfile** (`uv`).

---

## App assembly

- Prefer an **application factory** (or module-level `app`) that returns or
  defines an ASGI **`app`** importable **without** binding a port, so tests can
  mount the same application lifecycle as production.
- Keep **HTTP entry** separate from **process entry**: e.g. `main.py` or
  `__main__` runs Uvicorn (or similar) against the importable `app`, mirroring
  the split between “create app” and “listen” in other stacks.

---

## Routing

- One **`APIRouter` (or equivalent) per domain**; mount routers under path
  prefixes that match your API design and your **OpenAPI** layout.
- Prefixes and tags should stay stable once clients exist; breaking path changes
  go through the same **spec + codegen** discipline as in
  [Python (monorepo) — OpenAPI](../../monorepo/python/STYLE_GUIDE.md#openapi-as-single-source-of-truth).

---

## Controllers and services

- **Thin route handlers:** parse/validate input, call a **service** layer, map
  results to HTTP responses. Heavy logic belongs in **`services/`** (or your
  package’s equivalent feature folder), not in the router module.
- Use **FastAPI `Depends`** (or small explicit factories) for injectable
  dependencies: DB sessions, settings, current user, etc.

---

## Middleware

- Apply **CORS**, **request ID / correlation ID**, and **body size limits**
  deliberately — globally or per-router depending on risk, but **document** the
  choice per service.
- Prefer **JSON parsing** behavior consistent with your error contract (invalid
  JSON vs invalid body schema are different failures).

---

## Logging

- Use **structured JSON logs** (e.g. **`structlog`** or **`logging`** with a
  JSON formatter) as the default for services.
- **Field names and semantics** (e.g. `requestId`, `gameId`, levels) should
  follow your **organization-wide** observability standard so logs correlate
  across services regardless of language. If the repo also ships a Node API,
  align with that service’s logging table **by convention**, not by reading the
  Node guide as a prerequisite for Python work.

---

## Error handling

- Register a **single exception handler** (or small composable set) that maps
  exceptions to HTTP status codes and stable **JSON error bodies**.
- Distinguish **operational** errors (expected: validation, not found,
  conflict) from **unexpected** bugs (log with stack, return a generic 500 body).
- Define or reuse **typed errors** (exception classes or Pydantic error
  payloads) that match what **API clients** expect — including any **shared error
  types** consumed from generated OpenAPI or shared packages.

---

## Request validation

- **Pydantic v2** models at **every HTTP boundary** (path, query, body,
  headers). Do not accept `dict` blobs from the framework into business logic.
- Map validation failures to the same **HTTP status and body shape** your
  OpenAPI document and clients expect (typically **422** for request validation
  in FastAPI; align with your published spec).

---

## Environment configuration

- Load and validate settings with **`pydantic-settings`** (or equivalent) **at
  startup**. Do not scatter raw **`os.environ`** reads through handlers or
  services.

---

## Database

- Default story: **SQLAlchemy 2.x** with **Alembic** for migrations; **Postgres**
  in production and **SQLite** (or isolated Postgres) in tests unless the
  project documents otherwise.
- Mirror the **testing discipline** in
  [Python (monorepo) — Testing](../../monorepo/python/STYLE_GUIDE.md#testing):
  migrations, fixtures, and **serial** tests when tests share DB state.

---

## Polyglot monorepo checklist

When this Python service lives beside **TypeScript** apps in the same repo:

1. Wire **`turbo run test` / `lint` / `typecheck`** for the package per
   [Python (monorepo) — Python tasks in Turborepo](../../monorepo/python/STYLE_GUIDE.md#python-tasks-in-turborepo).
2. Treat the **committed OpenAPI** artifact as the cross-language HTTP contract
   when other languages consume this API — see
   [Python (monorepo) — OpenAPI](../../monorepo/python/STYLE_GUIDE.md#openapi-as-single-source-of-truth).
3. Keep **log correlation fields** compatible with the rest of the fleet (same
   names for request IDs, trace context, etc.).

---

## Related guides

- [Python (monorepo)](../../monorepo/python/STYLE_GUIDE.md) — required baseline
- [Python (client)](../../client/python/STYLE_GUIDE.md)
- [TypeScript (monorepo)](../../monorepo/typescript/STYLE_GUIDE.md) — only when
  you need **Node-side** workspace and Turborepo details in a polyglot repo
- [TypeScript (server)](../typescript/STYLE_GUIDE.md) — **separate** stack for
  Node-only APIs; not mixed with this guide for the same HTTP surface
