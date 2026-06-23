## 1. Database migration

- [x] 1.1 Add `webhook_requests` table to `app/data/migrate.ts` with id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payload JSONB, token TEXT, headers JSONB, source_ip TEXT, created_at BIGINT
- [x] 1.2 Add index on `token` and `created_at`

## 2. SSE infrastructure

- [x] 2.1 Create `app/lib/sse-events.ts` with a shared `createChannel` and helper functions to subscribe/publish webhook events

## 3. Webhook ingestion endpoint

- [x] 3.1 Create `app/actions/webhook/controller.tsx` — POST handler at `/webhook/:token` that validates token from env, parses JSON body, inserts into DB, emits SSE event
- [x] 3.2 Add route to `app/routes.ts`: POST `/webhook/:token`
- [x] 3.3 Wire route in `app/router.ts`

## 4. Webhook requests viewer (SSR page)

- [x] 4.1 Create `app/actions/webhook-requests/controller.tsx` — GET handler that queries `webhook_requests` with paging, sorting, filtering params
- [x] 4.2 Create `app/ui/webhook-requests-page.tsx` — SSR page component with table, pagination controls, sortable column headers, filter inputs
- [x] 4.3 Add SSE endpoint route at `GET /webhook-requests/events` that streams refresh events
- [x] 4.4 Add SSR route `GET /webhook-requests` and wire in `app/routes.ts` and `app/router.ts`
- [x] 4.5 Add client-side EventSource logic to auto-refresh the table when SSE fires
