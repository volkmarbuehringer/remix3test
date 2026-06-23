## Why

External services need to push JSON payloads into the app via a token-authenticated webhook. The received data should be stored and viewable in an admin-like SSR page with live updates.

## What Changes

- New `webhook_requests` DB table with UUID primary key and JSONB payload column
- New migration in `app/data/migrate.ts` creating the table
- New JSON POST endpoint at `/webhook/:token` that validates the token and inserts the payload
- New SSR route at `/webhook-requests` displaying the table contents with paging, sorting, and filtering
- SSE endpoint to push real-time refresh notifications when new requests arrive

## Capabilities

### New Capabilities

- `webhook-ingestion`: Token-authenticated JSON endpoint that receives and stores webhook payloads
- `webhook-requests-viewer`: SSR page with paging, sorting, filtering, and SSE-driven live refresh

### Modified Capabilities

None.

## Impact

- `app/data/migrate.ts` — new table creation
- `app/data/` — new data access module for webhook_requests
- `app/routes.ts` — new route definitions
- `app/router.ts` — new route wiring
- `app/actions/webhook/` — new controller for the ingestion endpoint
- `app/actions/webhook-requests/` — new controller for the viewer
- `app/ui/` — viewer page component
