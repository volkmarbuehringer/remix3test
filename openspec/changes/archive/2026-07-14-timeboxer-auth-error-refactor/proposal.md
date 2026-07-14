## Why

The timeboxer demo at `~/remix/demos/timeboxer/` has two recurring code quality issues that make it harder to maintain and extend:

1. **Auth guard repetition** — Every controller action manually checks `if (!auth.ok) return unauthorized()`. This is 7+ duplicated guard clauses across 4 controllers, obscuring the actual business logic.
2. **Inconsistent error responses** — Validation errors, constraint errors, and auth errors each return different JSON shapes (`{ error, fieldErrors, issues }` vs `{ error, fieldErrors }` vs just `{ error }`). Consumers must handle multiple error envelopes.

Both are mechanical refactors that remove duplication and enforce consistency without changing any user-facing behavior.

## What Changes

### 1. Extract Auth Guard to Middleware

- Add an `requireAuth` middleware that checks `auth.ok` and returns a 401 JSON response if unauthenticated
- Remove the `if (!auth.ok) return unauthorized()` pattern from all controller actions
- Guarded actions automatically get authentication enforcement via middleware configuration

### 2. Unify Error Responses

- Define a single `ApiError` response shape: `{ error: string, fieldErrors?: Record<string, string> }`
- Replace all ad-hoc error responses (`Response.json({...})` in controllers) with a shared helper
- Eliminate the `issues` array from validation error responses (data-schema issues are internal, not contractual)
- Consolidate `ScheduleDataError` / `DataTableConstraintError` dual-handling into one pathway

## Capabilities

### New Capabilities

None — this is an internal refactor of existing demo code. No new capabilities are introduced.

### Modified Capabilities

None — no spec-level behavior changes. The API contract changes (error response shape unification) are limited to the demo's internal JSON API, which has no external consumers.

## Impact

- `~/remix/demos/timeboxer/app/middleware/` — new `require-auth.ts` middleware file
- `~/remix/demos/timeboxer/app/actions/auth/controller.tsx` — remove 3 auth guard checks
- `~/remix/demos/timeboxer/app/actions/home/controller.tsx` — remove 1 auth guard check (already implicitly guarded by redirect logic; verify)
- `~/remix/demos/timeboxer/app/actions/schedules/controller.tsx` — remove 5 auth guard checks, replace error helpers with shared utilities
- `~/remix/demos/timeboxer/app/middleware/database.ts` — no changes (existing pattern continues to work)
- `~/remix/demos/timeboxer/app/data/schedules.ts` — `ScheduleDataError` remains but controller no longer catches it directly alongside `DataTableConstraintError`
- `~/remix/demos/timeboxer/app/router.ts` — register `requireAuth` middleware on schedule routes
- Tests: update assertions that match specific error response shapes
