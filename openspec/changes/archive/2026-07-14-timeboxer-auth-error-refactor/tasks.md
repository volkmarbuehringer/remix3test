## 1. Create shared API error utilities

- [x] 1.1 Create `~/remix/demos/timeboxer/app/utils/api-error.ts` with `apiError()`, `validationError()`, `unauthorized()`, and `notFound()` helpers using the unified `{ error, fieldErrors? }` envelope
- [x] 1.2 Move `fieldErrorsFromIssues()` and `fieldMessage()` logic from `schedules/controller.tsx` into `api-error.ts`
- [x] 1.3 Update `schedules/controller.tsx` to import from `api-error.ts` instead of using private helpers
- [x] 1.4 Verify all existing error response status codes are preserved

## 2. Create requireAuth middleware

- [x] 2.1 Create `~/remix/demos/timeboxer/app/middleware/require-auth.ts` that reads `context.get(Auth)`, returns 401 JSON if `!auth.ok`, otherwise calls `next()`
- [x] 2.2 Export `requireAuth` as a middleware factory function (consistent with `loadDatabase()` pattern)

## 3. Wire requireAuth into router

- [x] 3.1 In `~/remix/demos/timeboxer/app/router.ts`, import `requireAuth` from the new middleware module
- [x] 3.2 Apply `requireAuth()` to the schedules route mapping: `router.map(routes.schedules, requireAuth(), schedulesController)`
- [x] 3.3 Verify auth routes (login, signup, logout) remain unmounted from `requireAuth`

## 4. Remove inline auth guards from controllers

- [x] 4.1 In `auth/controller.tsx`: remove `if (!auth.ok) return redirect(routes.auth.login.index.href())` from `auth.index` (this is a page redirect, not JSON — already correct, keep it; the JSON 401 path doesn't apply here)
- [x] 4.2 In `schedules/controller.tsx`: remove all 6 inline `if (!auth.ok) return unauthorized()` checks (index, create, destroy, downloadIcs, show, update)
- [x] 4.3 Remove the private `unauthorized()` helper function from `schedules/controller.tsx`

## 5. Update downloadIcs special case

- [x] 5.1 The `requireAuth` middleware handles dual behavior (JSON → 401, HTML → redirect). `downloadIcs` inline checks removed. Middleware redirects HTML requests to login.
- [x] 5.2 Verify `downloadIcs` still redirects unauthenticated browser requests to the login page (handled by `requireAuth` middleware's dual-behavior check)

## 6. Update tests

- [x] 6.1 Update `controller.test.ts` assertion for `create` — previously checked `{ error, fieldErrors, issues }`, now checks `{ error, fieldErrors }` without issues array
- [x] 6.2 Update `authorization.test.ts` — these test auth failures explicitly; verify they still pass with middleware-level enforcement
- [x] 6.3 Update `validation.test.ts` — verify error shapes match new envelope
- [x] 6.4 Run full test suite for the timeboxer demo

## 7. Cleanup

- [x] 7.1 Remove any unused error-related imports from `schedules/controller.tsx`
- [x] 7.2 Verify `home/controller.tsx` is unchanged (its auth check is business logic, not a guard)
- [x] 7.3 Run `npm run typecheck` and `npm test` in the demo
