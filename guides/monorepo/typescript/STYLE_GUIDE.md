# Style Guide — TypeScript (monorepo)

> **pnpm workspaces, Turborepo, and top-level layout** for a full-stack monorepo (`apps/*`, `packages/*`).
> It does **not** repeat the general TypeScript language rules — read
> **[TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md)** first for ESM, `tsconfig`, ESLint,
> Prettier, Vitest, Zod, and conventions inside a single `src/`.

---

## When to read this

- You have (or are introducing) a **root** `package.json` that orchestrates **multiple** apps and packages
  with **Turborepo** and **pnpm** workspaces. Read this document **after**
  [TypeScript (platform)](../../platform/typescript/STYLE_GUIDE.md).
- You are **not** in a monorepo — a single `apps/api` or one package repo — you can skip this guide and
  rely on **platform** plus [server](../../server/typescript/STYLE_GUIDE.md) or [client](../../client/typescript/STYLE_GUIDE.md) as needed.

---

## Monorepo tooling

### Package manager

- **pnpm** with workspace configuration via `pnpm-workspace.yaml`.

### Task orchestration

- **Turborepo** handles task-level caching, parallelism, and dependency ordering across packages.

- **Root test script delegates to Turborepo:**

  ```jsonc
  // package.json (root)
  {
    "scripts": {
      "test": "turbo run test"
    }
  }
  ```

- **Configure the `test` task** with dependency ordering and caching, for example:

  ```jsonc
  // turbo.json
  {
    "tasks": {
      "test": {
        "dependsOn": ["^build"],
        "inputs": ["src/**", "*.config.ts"],
        "outputs": ["coverage/**"]
      }
    }
  }
  ```

  The `dependsOn: ["^build"]` pattern ensures tests run only after **upstream** packages that emit `dist/`
  or type artifacts have run their **`build`** task. `outputs` enables cache hits on re-runs. **Types-only**
  packages consumed via **source** exports often define **no** `build` script; Turborepo skips missing
  `build` on those dependencies, which is expected — see
  [TypeScript (platform) — package boundaries](../../platform/typescript/STYLE_GUIDE.md#package-boundaries-and-exports).

- Apply the same discipline to **`lint`**, **`typecheck`**, and other shared task names the team adopts so
  `turbo run <task>` behaves consistently in CI and locally.

---

## File and folder structure

Example layout (names are illustrative; adjust to your product):

```text
project-root/
├── apps/
│   ├── api/               # e.g. @battleship/api — Node server
│   │   ├── vitest.config.ts
│   │   └── src/           # feature folders, co-located tests — see platform guide
│   └── web/               # e.g. @battleship/web — React client
│       ├── vitest.config.ts
│       ├── index.html
│       └── src/
├── packages/
│   ├── types/             # shared types, Zod, errors
│   ├── util/
│   ├── tsconfig/          # shared base tsconfig
│   └── eslint-config/
├── turbo.json
├── pnpm-workspace.yaml
├── eslint.config.js
└── .prettierrc
```

- **Feature-based structure inside each `src/`** and **no internal barrel files** are defined in
  [TypeScript (platform) — layout within a package](../../platform/typescript/STYLE_GUIDE.md#layout-within-a-package).
- **Internal packages** use **TypeScript path aliases** and/or workspace `package.json` `workspace:` protocol
  as your template sets up — the **language** rules (extensions, `import type`, Zod) are all in the
  **platform** guide.

---

## Polyglot note

If the repo also contains **Python** services, their Turborepo wiring and example tree are in
[Python (monorepo)](../python/STYLE_GUIDE.md). The **Node** side of that story is this document; the
**Python** baseline is [Python (platform)](../../platform/python/STYLE_GUIDE.md).

---

## Related guides

- **TypeScript (platform)** — [../../platform/typescript/STYLE_GUIDE.md](../../platform/typescript/STYLE_GUIDE.md) — **read first**
- **Python (monorepo)** — [../python/STYLE_GUIDE.md](../python/STYLE_GUIDE.md)
- **Server (TypeScript)** — [../../server/typescript/STYLE_GUIDE.md](../../server/typescript/STYLE_GUIDE.md)
- **Client (TypeScript)** — [../../client/typescript/STYLE_GUIDE.md](../../client/typescript/STYLE_GUIDE.md)
