## 1. Add `RouterTypes` Declaration

- [x] 1.1 Add `declare module 'remix/fetch-router' { interface RouterTypes { context: AppContext } }` to `app/router.ts`

## 2. Convert `getContext()` Callers to Direct Properties

- [x] 2.1 `app/actions/auth-logout.tsx` — Replace `getContext().get(Session)` with `getContext().session`, remove `Session` import
- [x] 2.2 `app/utils/context.ts` — Replace `getContext().get(Auth)` with `getContext().auth`, remove `Auth` import
- [x] 2.3 `app/utils/error-handling.ts` — Replace `getContext().get(Session)` with `getContext().session`, remove `Session` import

## 3. Verify

- [x] 3.1 Run `pnpm run typecheck` to confirm 0 errors
- [x] 3.2 Run `pnpm test` to confirm all tests pass
