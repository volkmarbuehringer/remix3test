## Why

The existing `/lists` endpoints require session cookie authentication and CSRF tokens, making them unusable for API clients (curl, external services). A separate webhook-token-authenticated JSON API for lists is needed, reusing the same backend logic without duplication.

## What Changes

- Extract shared list CRUD logic from `app/actions/lists/controller.tsx` into `app/lib/lists-api.ts`
- Refactor existing controller to call the shared lib (no behavioral change)
- Create new token-authenticated API controller at `app/actions/api/lists/controller.tsx`
- Register new routes under `/api/lists` with CSRF exemption and Bearer token auth
- Add `GET /api/lists` (list all), `GET /api/lists/:id` (get one), `POST /api/lists` (create), `PUT /api/lists/:id` (update), `DELETE /api/lists/:id` (delete)

## Capabilities

### New Capabilities

- `api-lists`: Webhook-token-authenticated JSON API for lists with full CRUD, pagination, and filtering — reuses backend logic extracted from the existing controller

### Modified Capabilities

None — the existing user-facing `/lists` routes and admin `/admin/lists` remain unchanged in behavior.

## Impact

- `app/lib/lists-api.ts` — new shared module with `getAllLists`, `getListById`, `createList`, `updateList`, `deleteList`
- `app/actions/lists/controller.tsx` — refactored to call lib functions
- `app/actions/api/lists/controller.tsx` — new controller with webhook token auth
- `app/routes.ts` — new route definitions for `/api/lists`
- `app/router.ts` — wire new routes
- `app/middleware/skip-csrf.ts` — add `/api/lists` paths to CSRF exemption
- `app/actions/lists/controller.test.ts` — update to cover new lib functions
