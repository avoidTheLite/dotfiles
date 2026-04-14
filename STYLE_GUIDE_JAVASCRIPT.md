# Style Guide — TypeScript (index)

TypeScript conventions for a **full-stack monorepo** are split by **role**
(monorepo vs server vs client) so the same layout can mirror other languages
under `guides/server/python`, `guides/client/python`, etc.

## Read in this order

1. **[Monorepo](guides/monorepo/typescript/STYLE_GUIDE.md)** — ESM, `tsconfig`,
   ESLint/Prettier, editor, Vitest (server and client package configs), DB test
   setup, pnpm, Turborepo, repository layout.
2. **[Server (`apps/api`)](guides/server/typescript/STYLE_GUIDE.md)** — Express,
   Pino, errors, Zod env, Knex.
3. **[Client (`apps/web`)](guides/client/typescript/STYLE_GUIDE.md)** — React,
   Tailwind, TanStack Query, Zustand, RTL, MSW.

## All guides

See **[guides/INDEX.md](guides/INDEX.md)** and
[guides/manifest.json](guides/manifest.json).
