## 1. Fix Type Annotation on `loadDatabase()`

- [x] 1.1 Update `Middleware<readonly [typeof Database, Database]>` to `Middleware<{ key: typeof Database; value: Database }>` in `app/middleware/database.ts`

## 2. Verify

- [x] 2.1 Run `pnpm run typecheck` to confirm all 30+ errors are resolved
- [x] 2.2 Run `pnpm test` to confirm no test regressions (165/166 pass; 1 pre-existing failure unrelated to this change)
