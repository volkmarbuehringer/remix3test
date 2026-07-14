## Context

The timeboxer demo at `~/remix/demos/timeboxer/` uses a middleware pipeline built with `remix/router`. Authentication context (`Auth`) and the database (`Database`) are injected as typed context keys. Controllers receive these via `context.get(Key)`.

**Current state — auth guard repetition:**

Every action in every controller starts with the same pattern:

```typescript
let auth = context.get(Auth)!
if (!auth.ok) return unauthorized()
```

This appears in 7 action handlers across `auth/controller.tsx`, `home/controller.tsx`, and `schedules/controller.tsx`. The `unauthorized()` helper itself is defined privately in `schedules/controller.tsx` and doesn't exist in other files.

**Current state — error response zoo:**

Three different error shapes are returned by the schedules controller:

| Shape | Source | Example |
|---|---|---|
| `{ error, fieldErrors, issues }` | `validationError()` helper | `POST /schedules` validation fail |
| `{ error, fieldErrors }` | `fieldError()` helper, `handleCreateScheduleError()` | duplicate name |
| `{ error }` | `handleScheduleError()`, `unauthorized()` | schedule not found, auth failure |

The `issues` array exposes internal `data-schema` types to the API contract. The `fieldErrors` helper has ad-hoc field name mapping logic (`fieldMessage()`).

## Goals / Non-Goals

**Goals:**

- Remove all inline `if (!auth.ok) return unauthorized()` checks from controller actions
- Define a single, reusable `requireAuth` middleware that enforces authentication
- Define a single `ApiError` response shape for all JSON error responses
- Replace all ad-hoc error response construction with shared helpers
- Keep all test assertions passing (same status codes, same surface behavior)

**Non-Goals:**

- No changes to the HTML rendering paths (login redirect, etc.)
- No changes to the `home` controller's existing auth-aware redirect logic (it already handles unauthenticated users gracefully by rendering the home page)
- No changes to the data layer (`ScheduleDataError`, `DataTableConstraintError`)
- No introduction of a full framework-level error handling system
- No addition of client-side error handling changes

## Decisions

### Decision 1: Middleware-level auth guard vs per-route configuration

**Chosen approach:** A `requireAuth` middleware factory that controllers opt into by adding it to their route mapping in `router.ts`.

```typescript
// router.ts
import { requireAuth } from './middleware/require-auth.ts'

router.map(routes.schedules, requireAuth(), schedulesController)
router.map(routes.auth, auth)
// etc.
```

**Alternatives considered:**

- *Global auth middleware as a blanket check* — rejected because auth routes (login, signup) should be accessible without authentication.
- *Decorator/per-route config* — over-engineered for a demo; the middleware factory pattern is idiomatic Remix 3.
- *Continue with inline checks* — the status quo; this is what we're fixing.

**Why this approach:** It's the same pattern already established in the codebase (see `loadDatabase()`, `loadAuth()`). Middleware is the natural home for cross-cutting concerns in Remix 3's fetch-router architecture. Zero new concepts.

### Decision 2: How `requireAuth` integrates with existing `loadAuth`

The `requireAuth` middleware must run **after** `loadAuth()` in the pipeline. This is already guaranteed by registration order in `router.ts`:

```typescript
middleware: [
  session(...),
  formData(),
  csrf(),
  loadDatabase(),
  loadAuth(),        // must run before
]
// ...
router.map(routes.schedules, requireAuth(), schedulesController)
```

The `requireAuth` middleware reads `context.get(Auth)` which was set by `loadAuth()`. If `auth.ok` is false, it short-circuits with 401. Otherwise it calls `next()`.

### Decision 3: Single error response envelope

```typescript
type ApiError = {
  error: string
  fieldErrors?: Record<string, string>
}
```

- `error` — always present, human-readable message
- `fieldErrors` — present only for validation/field-level errors, maps field names to messages

This replaces the three current shapes including the `issues` array (which exposed `data-schema` internal types). The `issues` array provided detailed paths but was never consumed by the client (the grid uses field-level error display).

### Decision 4: Where shared error helpers live

A new file `app/data/api-error.ts` (or `app/utils/api-error.ts`) will contain:

- `apiError(message, status, fieldErrors?)` — creates `Response.json({ error, fieldErrors? }, { status })`
- `validationError(issues, status?)` — maps `data-schema` issues to `fieldErrors` shape
- Uses the existing `fieldErrorsFromIssues()` logic from `schedules/controller.tsx`

**Alternatives considered:**
- *A module named `errors.ts` in `app/data/`* — rejected because errors are an API concern, not data.
- *Inline in `schedules/controller.tsx`* — leaves the duplication partially unfixed (still private to one controller).
- *A separate `app/api/` directory* — over-engineered for a demo; `app/utils/` already exists for this.

### Decision 5: `home` controller unchanged

The `home` controller already handles unauthenticated users gracefully: it renders the home page instead of a schedule. It doesn't return JSON 401 errors like the other controllers. Its auth check is part of business logic, not a guard. **No change needed.**

## Risks / Trade-offs

- **[Risk] `requireAuth` middleware consumes the request** — If a route mounted with `requireAuth` should allow unauthenticated access for some actions (unlikely for schedules), you'd need per-action configuration. **Mitigation:** The schedules controller is entirely auth-gated, so this doesn't apply.
- **[Trade-off] Error response shape change is technically breaking** — The JSON API contract changes from three shapes to one. **Mitigation:** The timeboxer is a demo with no external consumers. The client-side grid code is in the same repo and will be updated.
- **[Risk] Forgetting to mount `requireAuth` on a route** — Similar risk to forgetting any middleware. **Mitigation:** Inline checks remain as a belt-and-suspenders safety net in the data layer (schedules.ts already requires a userId parameter that would fail silently without auth, but the db layer prevents cross-user access).

## Open Questions

- Should `requireAuth` accept a custom error message? E.g., `requireAuth('Admin access required')` vs the default "Authentication required." This is easy to add later if needed.
- The ICS `downloadIcs` action currently redirects non-JSON requests to the login page when unauthenticated (`wantsJson(request) ? unauthorized() : redirect(login)`). After the refactor, should the `requireAuth` middleware handle this dual-path, or should the ICS download remain a special case? **Current leaning:** Keep ICS as-is since its redirect-on-unauthenticated behavior is unique.
