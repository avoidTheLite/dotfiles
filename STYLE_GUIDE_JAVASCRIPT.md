# Style Guide — TypeScript (index)

TypeScript conventions are split by **scope**:

1. **[TypeScript (platform)](guides/platform/typescript/STYLE_GUIDE.md)** — **Language baseline** (Node/ESM,
   `tsconfig`, ESLint/Prettier, Vitest, Zod, layout _within_ a package). Read this **first** for any TS
   program.
2. **[TypeScript (monorepo)](guides/monorepo/typescript/STYLE_GUIDE.md)** — **Only** for **pnpm + Turborepo**
   workspaces (`turbo.json`, `apps/`, `packages/`, task graph). Skip if you have a single package.
3. **[Server](guides/server/typescript/STYLE_GUIDE.md)** and **[Client](guides/client/typescript/STYLE_GUIDE.md)** — Express vs React, etc.

**Python** in the same repository: [Python (platform)](guides/platform/python/STYLE_GUIDE.md) first, then
[Python (monorepo)](guides/monorepo/python/STYLE_GUIDE.md) for polyglot Turbo wiring.

## All guides

See **[guides/INDEX.md](guides/INDEX.md)** and
[guides/manifest.json](guides/manifest.json).
