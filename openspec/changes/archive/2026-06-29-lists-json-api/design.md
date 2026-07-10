## Context

The app currently has two authentication systems: session cookies (for browser users) and webhook Bearer tokens (for external services). Lists are managed through a single controller at `app/actions/lists/controller.tsx` that uses session auth + CSRF. There is no service layer — CRUD logic is inlined in action handlers. The admin panel at `app/actions/admin/lists/controller.tsx` duplicates query logic for filtering/pagination. Webhook-token-authenticated routes (`/webhook`, `/app-webhook`) demonstrate the pattern: `authenticateWebhook()` called inline, CSRF exempted by path in `skip-csrf.ts`.

## Goals / Non-Goals

**Goals:**

- Extract all list CRUD logic into a shared lib (`app/lib/lists-api.ts`)
- Refactor existing controller to call the lib (identical behavior, zero regression)
- Create new token-authenticated JSON API at `/api/lists` with full CRUD
- Include pagination and description-based filtering on the list endpoint
- Follow the existing webhook auth pattern: Bearer token, CSRF exemption, inline auth call

**Non-Goals:**

- No user-ownership scoping (lists table has no user_id; this remains global)
- No HMAC verification (adds complexity; can be added later)
- No changes to the admin panel or its query logic
- No removal or deprecation of the existing session-based endpoints

## Decisions

**1. Extract shared lib over importing action handlers directly**

- Importing action functions from a controller couples the API controller to the existing controller's internals and middleware assumptions
- A dedicated `app/lib/lists-api.ts` with pure functions (accepting `db` and params, returning data) is testable in isolation and reusable from both controllers, tests, and future consumers

**2. Exported functions follow a consistent signature**

- Each function accepts the database client + operation-specific params and returns typed results
- No Response objects — the caller (controller action) handles HTTP concerns (status codes, response format)
- This keeps the lib pure and the controller focused on auth + HTTP

**3. Pagination / filtering on `GET /api/lists`** mirrors the admin panel's approach

- `offset` and `limit` query params for pagination
- `filter` query param for ILIKE search on description and item labels (same GIN-backed query as admin)
- Returns `{ data: [...], hasMore: boolean, offset: number }`

**4. Token auth inline, not as middleware**

- Matches existing webhook pattern: call `authenticateWebhook(context.request)` at handler top
- Returns `401`/`503` `Response` on failure; continues on success
- Avoids needing a new middleware registration in the router

**5. CSRF exemption by path prefix**

- Add `/api/` prefix check to `skip-csrf.ts` rather than individual paths — clean, future-proof

## Risks / Trade-offs

- **[No user scoping] → Anyone with the webhook token can read/write all lists.** Acceptable — the webhook token is a shared secret. If per-user scoping is needed later, add a `user_id` column and a `where: { user_id }` filter.
- **[Extraction changes existing controller] → Must verify existing tests still pass.** The existing `controller.test.ts` covers the public endpoints; those tests should pass with zero changes after refactoring to the lib.
- **[Pagination query duplicated from admin] → Two implementations of the same GIN-backed search.** Acceptable for now — the admin controller has admin-specific concerns (audit logging, admin layout). Future refactoring could centralize the query.
