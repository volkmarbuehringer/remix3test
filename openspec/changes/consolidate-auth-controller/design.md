## Context

Six auth-related controllers are scattered across flat kebab-case directories in `app/actions/`:

```
app/actions/auth-login/controller.tsx        → routes.auth.login        (206 lines)
app/actions/auth-register/controller.tsx     → routes.auth.register     (280 lines)
app/actions/auth-forgotten/controller.tsx    → routes.auth.forgotten    (351 lines)
app/actions/auth-verify/controller.tsx       → routes.auth.verify       ( 58 lines)
app/actions/auth-logout/controller.tsx       → routes.auth.logout       ( 17 lines)
app/actions/auth/                            → only test files
```

Each is imported individually in `app/router.ts` (6 import lines). `remix doctor` cannot map these flat dirs back to route keys, producing 8 warnings.

The timeboxer demo (`~/remix/demos/timeboxer/app/controllers/auth/controller.tsx`) demonstrates the target pattern: a single file exporting multiple controllers (`auth`, `authLogin`, `authSignup`) with page components extracted to a co-located `pages.tsx`.

## Goals / Non-Goals

**Goals:**

- Merge 5 flat controller dirs into `app/actions/auth/controller.tsx`
- Extract page components to `app/actions/auth/pages.tsx`
- Update `app/router.ts` to a single import statement
- Delete the 5 flat directories
- Silence all `remix doctor` warnings related to auth routes
- Serve as proof-of-concept for the consolidation pattern

**Non-Goals:**

- Changing route behavior, URLs, or HTTP semantics
- Consolidating non-auth controllers (`admin/*`, `ai/*`, `verwaltung/*`)
- Changing how `createController`, `createAction`, or `router.map()` work
- Modifying shared UI components in `app/ui/`

## Decisions

1. **Extract pages to `pages.tsx`** — rather than inlining all page components into `controller.tsx` (~900 lines), follow the timeboxer pattern: keep `controller.tsx` focused on route/action logic and move all page components + their styles to `app/actions/auth/pages.tsx`. Each handler imports its page from `./pages.tsx`. This keeps the controller file readable (~200 lines) and pages modular.

2. **Named exports, no default** — timeboxer uses named exports for all sub-route controllers. The current default exports (`export default createController(...)`) become named exports (`export const authLogin = createController(...)`). This is a one-line change per handler but avoids ambiguity in the merged file.

3. **Keep `registerSent` and `verify` as plain functions** — these are async functions wired via `router.get()`, not `createController` wrappers. No change needed — they remain plain named exports in the merged file.

4. **Preserve existing test files in `auth/`** — `auth.test.e2e.ts` and `inspect.test.e2e.ts` stay in `app/actions/auth/`. They coexist alongside the new `controller.tsx` and `pages.tsx`.

5. **Single router import** — replace 6 individual imports with:
   ```typescript
   import {
     authLogin,
     authRegister,
     registerSent,
     verify,
     authForgotten,
     authForgottenReset,
     authLogout,
   } from './actions/auth/controller.tsx'
   ```

## Risks / Trade-offs

- **Large `pages.tsx`** — extracting all auth page components into one file creates ~700 lines. This is expected and follows the timeboxer pattern. If it grows further, pages can be split into separate files later.
- **Import conflict: `forgottenReset`** — current router imports `forgottenController` (default) and `forgottenReset` (named) from the same module. After consolidation, both are named exports. The import line needs a name adjustment to avoid collision with the `authForgotten` name — use `authForgottenReset` as the export name (consistent with `authLogin`, `authRegister` naming).
- **Rollback** — all changes are file moves and import rewrites. `git checkout` on the 6 deleted directories and `router.ts` fully reverses the spike. No database or schema changes.
- **Timing** — this is pure structural refactor. Can be done in one session, verified with typecheck + test run, and merged independently of other work.
