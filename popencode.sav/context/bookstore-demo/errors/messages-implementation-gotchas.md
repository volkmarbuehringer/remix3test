<!-- Context: bookstore-demo/errors/messages-implementation-gotchas | Priority: high | Version: 1.0 | Updated: 2026-04-30 -->

# Messages Implementation Gotchas

**Purpose**: Known issues, traps, and important details encountered during the messages feature implementation.

---

## 🚨 Critical: sendResponse Double-Read (SSE)

**Symptom**: SSE stream never sends broadcast messages. First client message hangs indefinitely.

**Root cause**: `sendResponse` in `@remix-run/node-fetch-server` reads **two chunks** from the `ReadableStream` before writing the first response byte. If `start()` enqueues only one chunk, the second `read()` call blocks forever.

**Fix**: Always enqueue **2+ chunks** in `ReadableStream.start()`:

```typescript
start(controller) {
  controller.enqueue(firstChunk)    // real event (e.g., "connected")
  controller.enqueue(secondChunk)   // heartbeat comment to satisfy double-read
}
```

See `guides/messages-sse-streaming.md` for full details.

---

## ⚠️ Form Submission Kills SSE Connection

**Symptom**: After posting a message, the EventSource disconnects and no longer receives live updates.

**Root cause**: Standard `<form>` submission causes full-page navigation. When the browser navigates, it tears down the page including the EventSource connection.

**Fix**: Intercept form submission with `fetch()` in client-side JS:

```javascript
form.addEventListener('submit', function(e) {
  e.preventDefault()
  fetch(form.action, { method: 'POST', body: new FormData(form), redirect: 'manual' })
  form.querySelector('textarea').value = ''
})
```

The `redirect: 'manual'` prevents the fetch from following the 302 redirect back to `/messages`.

---

## ⚠️ SSE Endpoint Must Be Mapped Separately from Controller

**Symptom**: SSE endpoint returns 404 or doesn't stream.

**Root cause**: The controller pattern (`router.map(routes.messages, messagesController)`) wraps actions with framework response handling. SSE needs to return a raw `Response` with a `ReadableStream` body — the controller's `subscribe` action would work, but it's cleaner to separate the streaming endpoint with its own middleware.

**Pattern**: Define `messagesSubscribe` as a top-level GET route in `routes.ts`, then map it separately in `router.ts` with inline `actions` and explicit `middleware: [requireAuth()]`.

---

## ⚠️ Rate Limiter Test Ordering

**Symptom**: Tests that POST messages fail intermittently when run together.

**Root cause**: Rate limiter is a module-level `Map<number, number>` with a 500ms window. When tests run sequentially without waiting, subsequent POSTs get rate-limited.

**Fix**: Insert `await new Promise(r => setTimeout(r, 600))` between sequential POSTs from the same user in tests.

```typescript
// In controller.test.ts, before sending as admin again:
await new Promise((r) => setTimeout(r, 600))
```

---

## ⚠️ PG BIGINT Returns Strings

**Symptom**: Numeric fields like `created_at` and `id` are strings in JS.

**Root cause**: PostgreSQL `BIGINT` exceeds JavaScript's safe integer range for some values, so `pg` driver returns them as strings.

**Fix**: Normalize in `getAllMessages()` helper and in `schema.ts` `afterRead`:

```typescript
id: typeof row.id === 'string' ? Number(row.id) : (row.id as number)
created_at: typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number)
```

This applies to all BIGINT columns across the codebase, not just messages.

---

## ⚠️ Empty Content Redirects Silently

**Behavior**: Posting empty or whitespace-only content redirects 302 → `/messages` with no error feedback to the user.

**Design choice**: The messages feature uses silent redirect on validation failure (empty content, rate limit exceeded) rather than showing error messages. This is intentional for simplicity but could be improved with flash messaging.

---

## ⚠️ SSE EventSource Delay on Page Load

**Implementation detail**: The EventSource is created inside a `window.addEventListener('load', ...)` with a 500ms `setTimeout` delay. This prevents race conditions where the EventSource tries to connect before the page navigation fully settles.

If you reduce or remove this delay, you may see intermittent "connected" events before the SSR page renders fully.

---

## ⚠️ Memory: Module-Level State Is Not Shared Across Workers

**Important**: The `sseClients` Set and `lastMessageTime` Map are module-level in-memory state. In a multi-worker or serverless deployment:
- Each worker has its own `sseClients` Set → SSE broadcasts only reach clients connected to the same worker
- Each worker has its own `lastMessageTime` Map → rate limiting is per-worker, not global

**Current scope**: Acceptable for single-process development/demo. For production, replace with external pub/sub (Redis, PostgreSQL LISTEN/NOTIFY).

---

## Codebase References

| Gotcha | File | Lines |
|--------|------|-------|
| sendResponse double-read | `app/router.ts` | 105-106 (comment), 123-126 |
| Form interception | `app/controllers/messages/page.tsx` | 183-193 |
| SSE separate mapping | `app/router.ts` | 107-142 |
| Rate limiter cleanup | `app/lib/messages-sse.ts` | 8-18 |
| PG BIGINT normalization | `app/controllers/messages/controller.tsx` | 38-44 |
| Empty content redirect | `app/controllers/messages/controller.tsx` | 62-67 |
| EventSource delay | `app/controllers/messages/page.tsx` | 196-197, 249 |
| Module-level state | `app/lib/messages-sse.ts` | 4, 7 |

## Related

- `concepts/messages-architecture.md` — Architecture decisions
- `guides/messages-sse-streaming.md` — SSE implementation with workaround
- `lookup/messages-integration-points.md` — Integration reference
