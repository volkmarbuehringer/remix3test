## Why

When Hermes processes a webhook payload asynchronously, the app currently has no way to receive the processing result. The `app-webhook-hermes` flow already returns a `callbackUrl` to callers, but no `/callback` endpoint exists to receive the result. This means the `webhook_requests` table never gets updated with the processing outcome, and there's no trace of what Hermes produced.

## What Changes

- Add a `callback_response` JSONB column to the `webhook_requests` table to store the callback payload
- Add a `callback_received_at` BIGINT column to track when the callback arrived
- Create `POST /callback` endpoint that:
  - Accepts JSON body with `id` (UUID), `status` (string), and `result` (any JSON)
  - Only accepts requests from localhost (127.0.0.1, ::1)
  - Looks up the `webhook_requests` row by `id` and stores the callback payload
  - Returns 200 on success, 404 if id not found, 403 if not localhost
- Register the route in `routes.ts` and wire it in `router.ts`
- Create `app/actions/callback/controller.tsx` for the handler

## Capabilities

### New Capabilities

- `callback-endpoint`: Receives async processing results from Hermes via POST and stores them in the `webhook_requests` table with a JSONB payload

### Modified Capabilities

- `app-webhook-hermes`: The response already includes `callbackUrl` — now the endpoint it points to actually exists. No spec-level requirement changes, only implementation.
- `webhook-requests-viewer`: May want to display `callback_response` and `callback_received_at` in the viewer table in the future (out of scope for this change).

## Impact

- **Database**: New migration adds `callback_response JSONB` and `callback_received_at BIGINT` columns to `webhook_requests`
- **Routes**: New `POST /callback` route in `routes.ts`
- **Router**: New import and `router.post()` call in `router.ts`
- **Controller**: New `app/actions/callback/controller.tsx`
- **Environment**: No new env vars needed (localhost-only check is implicit)
