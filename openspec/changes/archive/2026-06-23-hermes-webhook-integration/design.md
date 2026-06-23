## Context

The app already has a `POST /webhook/:token` endpoint that ingests JSON payloads into the `webhook_requests` table (UUID PK via `gen_random_uuid()`) and returns the generated ID. We need a separate endpoint that additionally forwards the ingested data to the hermes event processor (`http://127.0.0.1:8644/webhooks/app-webhook`) for background processing.

The hermes service accepts POST requests with `{ "id": "<uuid>", "payload": { ... } }` and returns `{ "status": "accepted", "route": "app-webhook", "event": "unknown", "delivery_id": "<id>" }`.

## Goals / Non-Goals

**Goals:**
- New `POST /app-webhook/:token` route that inserts payloads with RETURNING UUID and forwards to hermes
- Token-based authentication (reuse `WEBHOOK_TOKEN` env var or add `APP_WEBHOOK_TOKEN`)
- Non-blocking hermes forward: failure to reach hermes does not break the API response
- CSRF exemption for the new route (following existing pattern)
- Return the hermes `delivery_id` in the response alongside the local UUID

**Non-Goals:**
- No new database table — reuse `webhook_requests`
- No retry/queue for failed hermes deliveries (hermes accepts synchronously)
- No changes to the existing `POST /webhook/:token` endpoint behavior

## Decisions

1. **Reuse `webhook_requests` table**: The existing table has a UUID PK with `gen_random_uuid()` and a JSONB payload column. Adding a separate table would duplicate schema without benefit.

2. **Route path `POST /app-webhook/:token`**: Distinct from `POST /webhook/:token` to avoid breaking existing consumers. The path reflects the hermes routing (`route: "app-webhook"`).

3. **Reuse `WEBHOOK_TOKEN` env var**: Single token for both webhook endpoints simplifies deployment config. The existing validation logic is identical.

4. **Fire-and-forget hermes fetch with 5s timeout**: The hermes forward runs in the same request cycle but with a timeout guard. If hermes is unreachable, log the error and still return success to the caller (data is persisted). This avoids coupling the API's availability to hermes uptime.

5. **New controller at `app/actions/app-webhook/controller.tsx`**: Follows the existing controller-per-feature pattern established by other action controllers.

6. **Extend `skip-csrf.ts` to also skip `/app-webhook/`**: Simple path check addition to the existing CSRF skip middleware.

## Risks / Trade-offs

- [Reliability] Hermes unavailability delays the response (5s timeout) → Mitigation: shorter timeout (3s), and only fail the response if the DB insert succeeds; return partial success with `hermes_status: "unreachable"`
- [Security] Sharing `WEBHOOK_TOKEN` means compromising one endpoint compromises both → Accepted for now; can split tokens later
- [Throughput] Synchronous hermes fetch adds latency to each request → Accepted for MVP; async queue is a future optimization
