## 1. Controllers — Replace console.error with context.logger

- [x] 1.1 Auth controller: replace 2 `console.error` calls in `app/actions/auth/controller.tsx` with `context.get(Logger)?.()`
- [x] 1.2 Admin controller: replace `console.error` call in `app/actions/admin/controller.tsx` with `context.get(Logger)?.()`
- [x] 1.3 Verwaltung controller: replace 4 `console.error` calls in `app/actions/verwaltung/controller.tsx` with `context.get(Logger)?.()`
- [x] 1.4 Nutzer controller: replace 2 `console.error` calls in `app/actions/nutzer/controller.tsx` with `context.get(Logger)?.()`

## 2. AI Controller — Migrate from userLogger to context.logger

- [x] 2.1 Replace 6 `userLogger(...)` calls in `app/actions/ai/controller.tsx` with `context.get(Logger)?.()` and explicit user-context prefix
- [x] 2.2 Remove `userLogger` import from `app/actions/ai/controller.tsx`

## 3. Middleware — Replace raw console.warn

- [x] 3.1 Replace `console.warn` in `skipAssetsLogger` (`app/middleware/root.ts:31`) with `context.get(Logger)?.()`
- [x] 3.2 Replace `console.warn` in `app/middleware/global-rate-limit.ts:37` with `context.get(Logger)?.()`

## 4. Cleanup

- [~] 4.1 `app/utils/logger.ts` kept — `workflows/` module still uses `userLogger` (separate concern, not request-scoped)
- [x] 4.2 Update `app/middleware/root.test.ts` to intercept `console.log` instead of `console.warn` for asset error tests
- [x] 4.3 Run `pnpm exec typecheck` and `pnpm test` to verify no regressions
