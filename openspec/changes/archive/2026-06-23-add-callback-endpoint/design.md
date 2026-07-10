## Context

The app has a `webhook_requests` table that stores incoming webhook payloads. The `app-webhook-hermes` endpoint accepts POST requests, inserts a row with a generated UUID, forwards the data to the Hermes event processor, and returns a `callbackUrl` in the response. Currently no endpoint exists to receive the callback when Hermes finishes processing — the `callbackUrl` points nowhere.

The app uses Remix 3 with raw PostgreSQL via the `pg` pool. Existing POST-only routes (like webhooks) use `createAction` from `remix/router`. Route definitions live in `routes.ts` and are wired in `router.ts`.

## Goals / Non-Goals

**Goals:**

- Provide a `POST /callback` endpoint that Hermes can POST results to
- Accept JSON body: `{ "id": "<uuid>", "status": "completed|failed", "result": { ... } }`
- Only accept requests from localhost (127.0.0.1, ::1)
- Store the callback payload in a new `callback_response` JSONB column on the matching `webhook_requests` row
- Store the reception timestamp in a new `callback_received_at` BIGINT column
- Return 200 on success, 404 if UUID not found, 403 if not localhost

**Non-Goals:**

- Adding callback display to the webhook-requests viewer page (future work)
- Retry or queue logic for callbacks
- Authentication beyond localhost restriction (Hermes runs on the same machine)
- Modifying the existing webhook ingestion flow

## Decisions

| Decision               | Choice                                                                         | Rationale                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Localhost check        | Check `X-Forwarded-For`, `X-Real-Ip`, then `REMOTE_ADDR` (via request headers) | Hermes runs on same host; no shared secret needed                          |
| Controller pattern     | `createAction` in `app/actions/callback/controller.tsx`                        | Consistent with existing `webhookReceive` and `appWebhookReceive` patterns |
| Store raw JSONB result | Store exactly what Hermes sends in `callback_response`                         | Schema-agnostic; works with any Hermes result shape                        |
| Migration strategy     | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `migrate.ts`                     | Consistent with existing `hermes_status` pattern; idempotent               |
| No schema.ts entry     | Keep raw SQL for `webhook_requests`                                            | Already not in schema.ts; raw SQL is the existing pattern for this table   |

## Risks / Trade-offs

- **Hermes sends malformed JSON** → The endpoint parses the body with `context.request.json()`; invalid JSON returns 400 before any DB write
- **UUID not found in table** → Return 404; no data loss since the webhook INSERT already succeeded
- **Localhost spoofing** → `X-Forwarded-For` can be set by clients; mitigate by checking the direct connection address when behind a proxy. Acceptable risk since Hermes runs on the same machine and the app is not exposed to the internet directly.
- **Missing migration on existing deployments** → Migration is idempotent (`IF NOT EXISTS`); safe to run repeatedly
