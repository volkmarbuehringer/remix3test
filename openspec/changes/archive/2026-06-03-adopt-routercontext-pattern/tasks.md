## 1. Extract middleware factory in `app/router.ts`

- [x] 1.1 Create `createNewappMiddleware(cookie, storage)` factory function using `createMiddleware()` — wraps all 12 middleware functions in the same order as the current middleware array
- [x] 1.2 Derive `AppContext` type: `type AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>`
- [x] 1.3 Update `createNewappRouter()` to call `createNewappMiddleware(cookie, storage)` instead of inline array
- [x] 1.4 Remove explicit `<AppContext>` generic from `createRouter()` call (inferred from middleware chain)
- [x] 1.5 Verify default `export const router = createNewappRouter()` still works

## 2. Update `app/types/context.ts`

- [x] 2.1 Replace `RootMiddleware` tuple and explicit `MiddlewareContext<RootMiddleware>` with `createMiddleware()` factory + `AppContext` type
- [x] 2.2 Verify no circular dependency — `createNewappMiddleware` factory and `AppContext` type co-located in `context.ts`; `router.ts` imports from `context.ts`; no cycle
- [x] 2.3 Clean up unused middleware imports from `app/router.ts` — only `Cookie`, `createRouter`, `SessionStorage`, `sessionCookie`, `sessionStorage` remain

## 3. Remove AppContext generics from controllers

> **Skipped**: `createController()`'s `context` generic defaults to `DefaultContext`, not `RouterTypes.context`. Without the explicit `AppContext` generic, TypeScript cannot resolve middleware-provided context properties (`context.formData`, `context.auth`, `context.db`, `context.render`). The `timeboxer` demo avoids this by using `context.get(Auth)` — never property access — which is a larger refactor than scoped here.
>
> Controllers retain their `createController<typeof routes.X, AppContext>(...)` calls. The `AppContext` type now derives from `createMiddleware()` instead of the manual `RootMiddleware` tuple.

- [x] 3.1 Controllers unchanged — type derives from `context.ts` as before, but `context.ts` uses `createMiddleware()` internally

## 4. Clean up unused AppContext imports

> **Skipped**: Since controllers retain the `AppContext` generic, the imports remain needed. No cleanup required.

- [x] 4.1 No import removals needed

## 5. Verification

- [x] 5.1 Run full typecheck: `npx tsc --noEmit` — **0 errors**
- [x] 5.2 Run tests: `npm test` — **733 pass, 0 fail**
- [x] 5.3 Verify no `RootMiddleware` remains — `grep -rn RootMiddleware app/` returns nothing
- [x] 5.4 Verify `app/types/context.ts` uses `createMiddleware()` pattern — confirmed
