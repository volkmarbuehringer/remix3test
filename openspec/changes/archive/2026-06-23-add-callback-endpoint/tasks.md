## 1. Database Migration

- [x] 1.1 Add `callback_response JSONB` and `callback_received_at BIGINT` columns to `webhook_requests` in `app/data/migrate.ts` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

## 2. Route Definition

- [x] 2.1 Add `export const callbackRoute = post('/callback')` to `app/routes.ts`
- [x] 2.2 Import `callbackRoute` and wire `router.post(callbackRoute, callbackReceive)` in `app/router.ts`

## 3. Controller

- [x] 3.1 Create `app/actions/callback/controller.tsx` with `createAction` handler that:
  - Checks request originates from localhost (return 403 if not)
  - Parses JSON body with `id`, `status`, `result` fields
  - Validates `id` is present (return 400 if missing)
  - Updates `webhook_requests` row by `id` with `callback_response` JSONB and `callback_received_at` timestamp
  - Returns 404 if no row matches
  - Returns 200 `{ "status": "ok" }` on success

## 4. Verify

- [x] 4.1 Run `npm run typecheck` to verify TypeScript compilation
- [x] 4.2 Run `npm test` to verify no regressions
