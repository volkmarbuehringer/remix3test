## Why

The existing `POST /webhook/:token` endpoint ingests webhook payloads into the database and returns the UUID, but does not forward them to downstream services. We need a new webhook route that inserts incoming data, retrieves the generated UUID via `RETURNING`, and forwards both the UUID and payload to the hermes event processor (`http://127.0.0.1:8644/webhooks/app-webhook`) for background processing.

## What Changes

- Add a new `POST /app-webhook` route (token-authenticated) that:
  - Validates the request (JSON content type, payload size, auth token)
  - Inserts the payload into the `webhook_requests` table with `RETURNING id`
  - Fires a POST to hermes at `http://127.0.0.1:8644/webhooks/app-webhook` with body `{ "id": "<uuid>", "payload": { ... } }`
  - Returns the hermes `delivery_id` in the response
- Register the new route in `routes.ts`, `router.ts`, and create the controller in `app/actions/app-webhook/controller.tsx`
- Skip CSRF for the new route (extend existing `skip-csrf.ts` middleware)

## Capabilities

### New Capabilities

- `app-webhook-hermes`: New authenticated webhook endpoint that ingests JSON payloads, persists them with a UUID, and forwards to the hermes event processor for background handling

### Modified Capabilities

<!-- No existing spec-level behavior is changing -->

## Impact

- New controller: `app/actions/app-webhook/controller.tsx`
- New route: `POST /app-webhook/:token` in `routes.ts`
- Updated router wiring in `router.ts`
- Updated CSRF skip middleware to include the new route path
- External dependency: hermes service at `http://127.0.0.1:8644`
