## Context

The current auth architecture uses `remix/auth-middleware` for request-level auth enforcement. Most controllers (AI, admin) use `requireAuth()` middleware applied at the controller level. However, three inconsistencies exist:

1. **`/client/*` has no auth** — The client controller has `middleware: []`, allowing unauthenticated CRUD on client records.
2. **Main controller uses ad-hoc auth** — The `controller.tsx` has a local `requireAuth()` helper (loose typed, no frame awareness) used only for `lists`/`listsShow` routes, while `/`, `/ui/*`, `/assets/*` are intentionally public.
3. **Login controller doesn't use `completeAuth()`** — The `remix/auth` package provides `completeAuth()` to standardize session regeneration after login, but the login controller does it manually.
4. **`session.regenerateId(true)` inconsistency** — Login passes `true` (persist immediately) but logout doesn't.

All controllers and middleware live under `app/actions/` and `app/middleware/` respectively, using Remix 3's fetch-router framework.

## Goals / Non-Goals

**Goals:**
- `/client/*` routes require authentication before any CRUD operation
- `lists`/`listsShow` routes use the same `requireAuth()` middleware as all other protected controllers
- Login controller uses the standard `completeAuth()` utility
- `session.regenerateId()` calls are consistent across login and logout
- No regressions in existing auth behavior (redirects, frame awareness, returnTo)

**Non-Goals:**
- CSRF protection (separate concern)
- Password reset/forgot password flow
- OAuth provider integration
- Rate limiter persistence (in-memory is acceptable for current scale)

## Decisions

### Decision 1: Lists routes get their own controller rather than co-located middleware

**Option A** (selected): Extract `lists`/`listsShow` into `app/actions/lists/controller.tsx` with `middleware: [requireAuth()]`.

**Option B**: Apply `requireAuth()` as middleware on the main controller and exempt public routes. Rejected because the middleware model applies to ALL routes in a controller — there's no per-action middleware slot in `createController`.

**Option C**: Keep the inline `requireAuth()` function but import the proper one from `middleware/auth.ts`. Rejected because the current middleware architecture is cleaner — every other protected controller uses `middleware: [requireAuth()]`, and `lists` should follow the same pattern.

**Rationale**: Splitting into a separate controller is consistent with how AI routes (`ai-controller.tsx`, `chat-controller.tsx`) and admin routes (`admin-controller.tsx`) already work. The route split happens at the router level and is a 3-line change.

### Decision 2: Use `completeAuth()` in login controller

**Option A** (selected): Replace `let session = context.session; session.regenerateId(true); session.set('auth', ...)` with `let session = completeAuth(context); session.set('auth', ...)`.

**Option B**: Keep manual approach. Rejected — `completeAuth()` is the standard library utility specifically designed for this purpose. Using it improves consistency with the documented patterns and future-proofs against changes to session regeneration logic.

**Rationale**: `completeAuth()` encapsulates exactly the pattern currently done manually. It handles the `getSession` call and `regenerateId(true)` internally. The change is mechanical — same behavior, less code.

### Decision 3: Add `requireAuth()` middleware to client controller

The client controller gets `middleware: [requireAuth()]` — identical to how AI controllers are protected. This is a one-line addition. All CRUD endpoints (GET /client/grid, POST /client, PUT /client/:id, DELETE /client/:id) will block unauthenticated requests with a 302 redirect to `/login`.

### Decision 4: Normalize `session.regenerateId()` to always pass `true`

Both login and logout will pass `true` to `regenerateId`. The boolean signals immediate persistence of the new session ID. For login this is critical (the new auth state must be saved). For logout it's also correct — the session ID rotation should persist immediately to prevent fixation attacks on the stale ID.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Lists controller split could miss a route if new list routes are added without updating `router.ts` | Follow the existing pattern: each controller explicitly maps routes in `router.ts`. Adding a route requires updating both files. |
| Client controller gets auth where it might need public access for some operations | Currently ALL client operations are behind the same controller. If public read-only access is needed later, a separate public endpoint can be created. |
| `completeAuth()` changes behavior if the library updates | This is a benefit, not a risk — `completeAuth()` is the maintained path for session completion. Manual implementations would diverge. |
