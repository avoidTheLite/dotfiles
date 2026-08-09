# Style Guide — Python (monorepo)

> **Polyglot** repositories that use **pnpm**, **Turborepo**, and **Python** side by side. This document does
> **not** repeat the general Python language rules — read **[Python (platform)](../../platform/python/STYLE_GUIDE.md)**
> first (uv, Ruff, Pyright, Pydantic, OpenAPI, pytest, `src/` layout).
>
> For the **Node** workspace (pnpm, `turbo.json`, `apps/`, `packages/`), read
> **[TypeScript (monorepo)](../typescript/STYLE_GUIDE.md)**. That guide and this one are the two halves of
> **orchestration**; **Python (platform)** is the **language** baseline for every Python file.

---

## When to read this

- The repo has a **root** `package.json` with **Turborepo** and at least one **Python** package (often under
  `apps/` or `packages/`) that must participate in the same `turbo run test` (and `lint` / `typecheck`)
  **task names** as TypeScript. Read this **after** [Python (platform)](../../platform/python/STYLE_GUIDE.md).
- You only ship **Python** from a stand-alone service repo with no Turborepo — you can **skip** this
  document; use **platform** plus [server](../../server/python/STYLE_GUIDE.md) (or other domain guides) only.

---

## Monorepo tooling (Python side)

- **Node side** is **pnpm** workspaces and **Turborepo** as in
  [TypeScript (monorepo)](../typescript/STYLE_GUIDE.md).
- **Python packages** expose uniform **`pyproject.toml`** (or `uv`) scripts with predictable names so
  Turborepo can invoke the same **task** labels across languages:

  | Task | Typical command |
  |------|-----------------|
  | `lint` | `ruff check` (and optionally `ruff format --check`) |
  | `format` | `ruff format` |
  | `typecheck` | `pyright` |
  | `test` | `pytest` |

- Root or per-app **`package.json`** may wrap `uv run` so `turbo run test` calls Python the same way it
  calls Vitest. Exact wiring is a template concern; the **names** should match what `turbo.json` declares.

---

## Python tasks in Turborepo

Polyglot repos define **`turbo.json`** once; Python participates via `package.json` → **`uv run`** (or
`turbo` calling `uv` directly if you standardize that).

### Standard `inputs` and `outputs`

Include Python paths so cache invalidation is correct, for example:

- `pyproject.toml`, `uv.lock`
- `src/**`, `tests/**`, `**/*.py`
- `ruff.toml` / `[tool.ruff]` roots
- `pyrightconfig.json` / `[tool.pyright]`

For **`test`**, set **`outputs`** (for example `coverage/**`) if you want Turbo cache hits on re-runs.

### `dependsOn: ["^build"]`

- **TypeScript** packages often need a **`build`** task.
- **Pure Python** packages with **editable** installs often have **no** `build` — Turborepo skips missing
  `build`; see [TypeScript (monorepo)](../typescript/STYLE_GUIDE.md) and
  [Python (platform) — file structure](../../platform/python/STYLE_GUIDE.md#file-and-folder-structure).
- If a Python step **emits a wheel** or codegen others consume, add a real **`build`** and wire `dependsOn`
  accordingly.

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

---

## File and folder structure (polyglot)

Python services sit beside TypeScript `apps` and shared `packages` (OpenAPI, types, and so on). The **full**
language rules for package internals remain in [Python (platform)](../../platform/python/STYLE_GUIDE.md).

```text
project-root/
├── apps/
│   ├── api/                    # e.g. TypeScript API
│   └── py-api/                 # Python FastAPI service
│       ├── pyproject.toml
│       ├── uv.lock
│       └── src/
│           └── py_api/
│               ├── __init__.py
│               ├── main.py
│               ├── config.py
│               └── game/
│                   ├── router.py
│                   ├── schemas.py
│                   ├── service.py
│                   └── test_router.py
├── packages/
│   ├── openapi/                # optional: committed OpenAPI
│   ├── py-util/
│   │   ├── pyproject.toml
│   │   └── src/py_util/
│   └── types/                  # e.g. TypeScript shared types
├── turbo.json
├── pnpm-workspace.yaml
└── pyproject.toml              # optional: uv workspace root
```

---

## Related guides

- **Python (platform)** — [../../platform/python/STYLE_GUIDE.md](../../platform/python/STYLE_GUIDE.md) — **read first**
- **TypeScript (monorepo)** — [../typescript/STYLE_GUIDE.md](../typescript/STYLE_GUIDE.md)
- **TypeScript (platform)** — [../../platform/typescript/STYLE_GUIDE.md](../../platform/typescript/STYLE_GUIDE.md)
- **Python (server)** — [../../server/python/STYLE_GUIDE.md](../../server/python/STYLE_GUIDE.md)
- **Python (client)** — [../../client/python/STYLE_GUIDE.md](../../client/python/STYLE_GUIDE.md)
- **Python (AI / CLI / data)** — [../../ai/python/STYLE_GUIDE.md](../../ai/python/STYLE_GUIDE.md) and siblings
