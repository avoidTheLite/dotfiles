Fallout Queue
1. Missing .npmrc hoist rule for workspace packages
pnpm's isolated linker doesn't hoist @peacekeepers/* packages into @peacekeepers by default — they land in .pnpm/node_modules/. TypeScript can't walk that path for extends. Fix: always include public-hoist-pattern[]=@scope/* in .npmrc for any monorepo where tsconfig packages extend each other by package name.

2. TypeScript server needs restart after pnpm install changes
After hoisting rules are applied via a reinstall, VS Code's tsserver caches the old (failed) resolution. The TS server must be restarted manually (TypeScript: Restart TS Server) — it doesn't auto-detect node_modules changes.

3. Error.captureStackTrace is not in standard TypeScript types
It's a V8/Node.js runtime API absent from ErrorConstructor in lib.es*.d.ts. Any custom error class using it needs a safe cast: (Error as unknown as { captureStackTrace: ... }).captureStackTrace?.(). Style guide: always guard V8-only APIs with a cast + optional call.

4. .ts extension imports depend on tsconfig inheritance
The allowImportingTsExtensions: true in base.json was correct, but because the tsconfig extends was broken, TS fell back to defaults and rejected the .ts extensions. This was a cascading error — fixing the hoisting resolved it too. Style guide: tsconfig errors cascade; fix resolution first before treating downstream import errors as separate issues.