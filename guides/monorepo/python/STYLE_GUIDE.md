# Style Guide — Python (monorepo)

> Applies to **all** Python packages in a polyglot monorepo (`apps/*`, `packages/*`
> Python services and libraries) alongside the TypeScript stack. Read this guide
> before any **Python** server, client, or domain-specific Python guide.
>
> For **pnpm, Turborepo, and repository layout** shared with Node, still read
> [TypeScript (monorepo)](../typescript/STYLE_GUIDE.md) where tasks and workspaces
> are defined in JS terms; this document defines how **Python** plugs into the
> same task graph and conventions.

---

## Table of Contents

- [Purpose and scope](#purpose-and-scope)
- [Environment baseline](#environment-baseline)
- [Core stack](#core-stack)
- [Framework defaults by context](#framework-defaults-by-context)
- [Project and import layout](#project-and-import-layout)
- [Formatting, linting, and typing](#formatting-linting-and-typing)
- [Contracts and validation](#contracts-and-validation)
- [OpenAPI as single source of truth](#openapi-as-single-source-of-truth)
- [Testing](#testing)
- [Monorepo tooling](#monorepo-tooling)
- [Python tasks in Turborepo](#python-tasks-in-turborepo)
- [File and folder structure](#file-and-folder-structure)
- [Dependencies and security](#dependencies-and-security)
- [Editor settings and pre-commit](#editor-settings-and-pre-commit)
- [CI expectations](#ci-expectations)
- [Explicitly out of scope or deferred](#explicitly-out-of-scope-or-deferred)
- [Related guides](#related-guides)

---

## Purpose and scope

This guide sets **cross-cutting** Python standards so teams do not re-decide
tooling, layout, testing, or polyglot contracts on every PR. It targets the same
**rigor bar** as [TypeScript (monorepo)](../typescript/STYLE_GUIDE.md).

**Domain-specific** rules (FastAPI routing depth, Typer CLI shape, CrewAI graphs,
Polars pipelines) live in companion guides; each links here for shared rules.

**Server implementation:** For a **given HTTP API**, adopt **either**
[Python (server)](../../server/python/STYLE_GUIDE.md) **or**
[TypeScript (server)](../../server/typescript/STYLE_GUIDE.md) as the **standalone**
authority for that surface — not both. Polyglot repos still use **OpenAPI** (this
guide) when multiple languages must agree on the wire contract.

| Domain | Guide |
|--------|--------|
| HTTP APIs, workers, persistence | [Python (server)](../../server/python/STYLE_GUIDE.md) |
| Browser or desktop UI in Python | [Python (client)](../../client/python/STYLE_GUIDE.md) |
| Agent / AI tooling | [Python (AI)](../../ai/python/STYLE_GUIDE.md) |
| CLI tools | [Python (CLI)](../../cli/python/STYLE_GUIDE.md) |
| Data processing / ETL | [Python (data)](../../data/python/STYLE_GUIDE.md) |

---

## Environment baseline

- **Python 3.13** is the required runtime baseline for local development, CI, and
  containers (`requires-python = ">=3.13,<3.14"` or equivalent in each package).
- **uv** is the standard package and workspace manager: virtual environments,
  dependency resolution, and lockfiles (`uv.lock`) committed at the workspace
  root or per-package as you standardize.
- **CI installs must be reproducible:** e.g. `uv sync --frozen` (or the
  equivalent flag set you adopt) so lockfiles are enforced.

---

## Core stack

| Concern | Standard | Rationale |
|---------|----------|-----------|
| Static type checking | **Pyright, strict mode** | Same role as `tsc` with `strict`; disallows implicit `Any` and untyped public surfaces; first-class in VS Code / Pylance |
| Runtime validation | **Pydantic v2** | Same role as Zod at boundaries; native to FastAPI and common AI stacks |
| Linting + formatting | **Ruff** | Single tool for lint + format + import sorting; configured in `pyproject.toml` |
| Package management | **uv** | Fast installs, workspace support, lockfile-friendly workflow |

### Key architectural rule

**Pydantic models are the contract layer.** At every **inter-system boundary**
(HTTP bodies, agent inputs/outputs, CLI payloads, ETL record handoffs, loaded
config), use a **Pydantic model**. Do **not** pass raw `dict` objects across
those boundaries. This mirrors the **Zod-at-boundaries** rule in the TypeScript
guides.

---

## Framework defaults by context

Use these defaults unless a product explicitly documents an exception in its
own README and domain guide.

| Context | Framework | Notes |
|---------|-----------|--------|
| Web APIs | **FastAPI** | Pydantic-native; OpenAPI from route models; async-first |
| CLI | **Typer** | Typed parameters map to CLI args; aligns with FastAPI ecosystem |
| Agent / AI | **CrewAI / LangGraph + Pydantic** | Structured tool and graph I/O |
| Data at scale | **Polars** | Prefer over pandas when typing and performance matter |

---

## Project and import layout

- Use a **`src/` layout** for every installable package:
  `packages/<name>/src/<import_name>/...` or `apps/<name>/src/<import_name>/...`.
- **First-party imports** use the **package import name** (absolute), not deep
  relative chains across package roots.
- **`__init__.py` files stay minimal.** Do not create **barrel** modules that
  re-export large trees (same spirit as **no `index.ts` barrels** in the
  TypeScript monorepo guide). Import from the defining module.
- **Feature folders** under `src/<package>/`: one folder per domain, with a
  `services/` (or equivalent) subfolder for business logic, mirroring the
  TypeScript layout story.

---

## Formatting, linting, and typing

### Ruff

- **Ruff** is the **only** formatter and primary linter. Configure extends or
  shared `[tool.ruff]` / `ruff.toml` at the repo root or in a small shared config
  package so all Python packages inherit one rule set.
- Integrate **Ruff format** with CI and editor format-on-save.

### Pyright

- Enable **strict** type checking for application code (via `pyrightconfig.json`
  or `[tool.pyright]` in `pyproject.toml`, or the VS Code / Pylance strict
  baseline aligned with that config).
- **Explicit return types on exported/public functions and methods** (package
  API surface). Infer return types on small private helpers when it stays clear.
  This mirrors **explicit return types on exported functions** in the
  TypeScript monorepo guide.

---

## Contracts and validation

- **Pydantic v2** models validate at **ingress** (parse, don’t cast).
- **Settings and environment** use **`pydantic-settings`** (or equivalent) at
  startup — avoid scattered raw `os.environ` reads in business logic.
- **HTTP error and validation shapes** should stay compatible with the shared
  API story consumed by TypeScript clients (see server Python guide and
  OpenAPI section below).

---

## OpenAPI as single source of truth

The **canonical wire contract** for HTTP APIs is a **committed OpenAPI document**
(YAML or JSON — pick one convention for the repo). TypeScript, Python, and other
consumers **derive** types and clients from that file; they do not each invent
independent path and body shapes.

### Authoring flow (default: implementation-led)

1. **FastAPI** route functions use **Pydantic** request/response models.
2. A script or CI step calls **`app.openapi()`** and writes or compares against
   the committed spec (for example `packages/openapi/openapi.yaml` or
   `contracts/api/openapi.json`).
3. **Pull requests** that change routes must include the **updated OpenAPI**
   artifact, or CI must fail when export produces a diff.

### TypeScript consumption

- Add a package script (for example `pnpm openapi:generate`) that reads the
  committed spec and emits **types** and optionally **clients** or hooks
  (`openapi-typescript`, Orval, Hey API, etc.).
- Decide as a team whether generated files are **committed** (recommended for
  clear PR diffs) or regenerated only in CI.

### Python consumption

- The **serving** FastAPI app usually **does not** codegen from its own OpenAPI
  if Pydantic models are already the source of the export.
- **Other** Python packages (workers, CLIs, integration tests) **may** codegen an
  HTTP client from the same spec so URLs and payload shapes stay aligned.

### CI guardrails

- **Drift check:** export OpenAPI from the application entrypoint and
  `git diff --exit-code` against the committed spec (or equivalent).
- **Downstream drift:** run TS (and optional Python client) codegen in CI and
  fail if generated outputs change without being committed.
- **Optional:** Spectral (or similar) to lint the OpenAPI document for naming,
  security schemes, and pagination consistency.

### Small follow-ups to pin in each application repo

- Exact **path** for the committed spec and **YAML vs JSON**.
- Chosen **codegen** tools per language.
- Whether the web client also generates **Zod** from OpenAPI for runtime
  validation, or relies on **types only** at compile time.

---

## Testing

### Test runner and plugins

- **pytest** is the standard test runner for all Python packages.
- **pytest-cov** for coverage reporting.
- **Hypothesis** for property-based tests; use it especially for logic driven by
  **Pydantic-shaped** or algebraic data (invariants, round-trips).

### File conventions

- **Co-locate** tests with the modules they test (same spirit as `*.test.ts` in
  the TypeScript monorepo guide).
- Prefer naming **`test_*.py`** next to or under a parallel `tests/` layout per
  package — pick one convention per repo and document it in CI; do not mix
  styles within a single package.
- Use **markers** for non-default suites: for example `integration`, `slow`,
  `requires_network`. Default CI may run only fast unit tests; scheduled or
  manual jobs run the rest.
- When tests share **database or global state**, run **sequentially** for that
  suite (pytest `-n 0` / single worker or a dedicated job), mirroring Vitest
  `--runInBand` where needed.

### Coverage

- Set **team policy** for coverage thresholds and exclusions (for example
  generated code, `if __name__ == "__main__"` blocks). Until pinned, document
  “minimum bar TBD” in the application repo README.

---

## Monorepo tooling

- **Node side** remains **pnpm** workspaces and **Turborepo** as described in
  [TypeScript (monorepo) — Monorepo Tooling](../typescript/STYLE_GUIDE.md#monorepo-tooling).
- **Python packages** expose uniform **`pyproject.toml`** scripts so Turborepo
  can call the same task names across languages where practical, for example:

  ```toml
  [project.scripts]
  # Prefer invoking via uv run:
  ```

  Typical script names (define under `[tool.uv]` / hatch / scripts as your
  template standardizes):

  | Task | Purpose |
  |------|---------|
  | `lint` | `ruff check` (and optionally `ruff format --check`) |
  | `format` | `ruff format` |
  | `typecheck` | `pyright` |
  | `test` | `pytest` |

  Root **or** per-package `package.json` may wrap `uv run` so `turbo run test`
  invokes Python tests the same way it invokes Vitest.

---

## Python tasks in Turborepo

Polyglot repos usually define **`turbo.json`** tasks once; Python packages
participate via **`package.json`** scripts that delegate to **`uv run`**, or via
**`turbo.json` `tasks`** that call `uv` directly if you use Turborepo’s
multi-language patterns.

### Standard inputs and outputs

Include Python-relevant paths in **`inputs`** so caching invalidates when
dependencies or config change, for example:

- `pyproject.toml`, `uv.lock` (or lockfile location)
- `src/**`, `tests/**`, `**/*.py`
- `ruff.toml` / `[tool.ruff]` roots
- `pyrightconfig.json` / `[tool.pyright]`

For **`test`**, set **`outputs`** if you want cache hits on unchanged re-runs,
for example `coverage/**` or `.coverage` (team choice; some teams omit
coverage outputs from turbo cache).

### `dependsOn: ["^build"]`

- **TypeScript** packages often need a **`build`** task so dependents emit
  `dist/` or `.d.ts`.
- **Pure Python libraries** consumed with **editable installs** often define **no
  `build` script**. Turborepo skips missing `build` on dependencies; document
  that Python leaf packages do not need a no-op `build` unless they produce a
  wheel for external consumers.
- If a Python package **builds a wheel** or codegen step that others require,
  add an explicit **`build`** script and keep **`dependsOn: ["^build"]`** on
  downstream **`test`** / **`lint`** as appropriate.

### Example `turbo.json` fragment (illustrative)

```jsonc
{
  "tasks": {
    "lint": {
      "inputs": ["src/**", "tests/**", "pyproject.toml", "ruff.toml", "uv.lock"]
    },
    "typecheck": {
      "inputs": ["src/**", "pyproject.toml", "pyrightconfig.json", "uv.lock"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/**", "pyproject.toml", "uv.lock"],
      "outputs": ["coverage/**"]
    }
  }
}
```

Adjust task names to match how your root **`package.json`** wires **`uv run`**
into Turborepo.

---

## File and folder structure

Example polyglot tree with Python alongside existing TypeScript apps (names are
illustrative):

```
project-root/
├── apps/
│   ├── api/                    # TypeScript API (existing)
│   └── py-api/                 # Python FastAPI service
│       ├── pyproject.toml
│       ├── uv.lock             # or hoisted workspace lock at root
│       └── src/
│           └── py_api/
│               ├── __init__.py
│               ├── main.py
│               ├── config.py
│               └── game/
│                   ├── router.py
│                   ├── schemas.py
│                   ├── service.py
│                   └── test_router.py   # co-located tests (if adopted)
├── packages/
│   ├── openapi/                # optional: committed openapi.yaml
│   │   └── openapi.yaml
│   ├── py-util/                # shared Python utilities
│   │   ├── pyproject.toml
│   │   └── src/py_util/
│   └── types/                  # TypeScript shared types (existing)
├── turbo.json
├── pnpm-workspace.yaml
└── pyproject.toml              # optional uv workspace root
```

**Conventions:** feature folders, minimal `__init__.py`, config modules colocated
under `src/` unless the team standardizes otherwise.

---

## Dependencies and security

- **Direct dependencies** are declared in **`pyproject.toml`**; lock with **uv**
  and commit **lockfiles**.
- Use **dependency groups** / optional extras for dev-only tools (linters,
  pytest, pyright) analogous to devDependencies in Node.
- Consider **`uv audit`** or **pip-audit** in CI as a team policy when you want
  automated vulnerability signal on top of lockfiles.

---

## Editor settings and pre-commit

- **VS Code / Cursor:** Ruff extension for lint and format; **Pylance** with
  **type checking mode** aligned to your **Pyright strict** baseline.
- **Format on save** with Ruff as the default Python formatter.
- **pre-commit:** at minimum **Ruff check** and **Ruff format** on staged files;
  **Pyright** may run in CI only if full-project typecheck is too slow for local
  hooks.

---

## CI expectations

Typical job order for a Python package:

1. Install with **frozen lockfile** (`uv sync --frozen`).
2. **`lint`** (Ruff).
3. **`typecheck`** (Pyright).
4. **`test`** (pytest; coverage optional).
5. **OpenAPI export / drift check** and **codegen drift check** when HTTP APIs
   exist.

Publish **coverage** or **JUnit** artifacts if the team uses them in review.

---

## Explicitly out of scope or deferred

- **conda / mamba** — not part of this stack; call out an exception path only if
  a project needs heavy scientific/native stacks.
- **Client state management** — same open TODO as the JavaScript client guide;
  document when you pick patterns for Python UIs.
- **Alternative Python runtimes** — if needed later, add a separate note or
  guide; not assumed here.

---

## Related guides

- **TypeScript (monorepo)** — [../typescript/STYLE_GUIDE.md](../typescript/STYLE_GUIDE.md)
- **Python (server)** — [../../server/python/STYLE_GUIDE.md](../../server/python/STYLE_GUIDE.md)
- **Python (client)** — [../../client/python/STYLE_GUIDE.md](../../client/python/STYLE_GUIDE.md)
- **Python (AI)** — [../../ai/python/STYLE_GUIDE.md](../../ai/python/STYLE_GUIDE.md)
- **Python (CLI)** — [../../cli/python/STYLE_GUIDE.md](../../cli/python/STYLE_GUIDE.md)
- **Python (data)** — [../../data/python/STYLE_GUIDE.md](../../data/python/STYLE_GUIDE.md)
