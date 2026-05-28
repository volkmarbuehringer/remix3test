<!-- Context: development/remix3/guides/sse-in-frames | Priority: high | Version: 1.1 | Updated: 2026-05-10 -->

# SSE in Frames

**Purpose**: Using Server-Sent Events inside a Remix 3 Frame fragment with real-time updates and form interception.

## Architecture

```
Browser                          Server
  │                                │
  ├── Frame: /messages             │
  │   ├── SSR content (messages)   │
  │   └── clientEntry (side-effect)│
  │       ├── EventSource ─────────┤──► GET /messages/subscribe (ReadableStream)
  │       └── fetch POST ──────────┤──► POST /messages (form handler → broadcast)
  │                                │
  └── SSE stream ◄─────────────────┘── event: message / data: {...}
```

## Key Patterns

### 1. SSE Endpoint is Separate from the Frame Route

The EventSource connects to a dedicated endpoint (`/messages/subscribe`), not the frame's own route (`/messages`). This keeps the SSE connection independent of frame navigation.

```typescript
// app/router.ts — flat controller for SSE endpoint
router.get(routes.messagesSubscribe, messagesSubscribe)
```

```typescript
// app/actions/messages-subscribe.tsx — ReadableStream SSE
export const messagesSubscribe = createAction<typeof routes.messagesSubscribe, AppContext>(
  routes.messagesSubscribe,
  ({ request }) => {
    let controller: ReadableStreamDefaultController
    let keepAlive: ReturnType<typeof setInterval> | undefined

    let stream = new ReadableStream({
      start(enqueueController) {
        controller = enqueueController
        sseClients.add(controller)

        // Connected event + heartbeat comment (double-chunk workaround for sendResponse)
        controller.enqueue(
          new TextEncoder().encode(
            `event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`,
          ),
        )

        // Periodic heartbeat prevents proxies from closing idle connections.
        // Without this, EventSource reconnects create stale controllers.
        keepAlive = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`))
          } catch {
            clearInterval(keepAlive)
            sseClients.delete(controller)
          }
        }, 30_000)

        // Reliable cleanup via request abort signal (fires on client disconnect).
        // ReadableStream.cancel() alone is not guaranteed in all environments.
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAlive)
          sseClients.delete(controller)
          try {
            controller.close()
          } catch {
            // Stream may already be closed.
          }
        })
      },
      cancel() {
        clearInterval(keepAlive)
        sseClients.delete(controller)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    })
  },
)
```

### 2. Form Submission Uses `fetch(redirect: 'manual')`

Inside a Frame, form submissions must NOT cause full page navigation — that would kill the EventSource connection. Use `fetch` with `redirect: 'manual'` and `e.preventDefault()`.

**Critical: Use event delegation, NOT direct form listeners.** When Frame content is replaced (via `innerHTML` from page refreshes), direct `form.addEventListener('submit', ...)` listeners are lost. Event delegation on `document` survives DOM swaps:

```typescript
document.addEventListener('submit', (e) => {
  let form = (e.target as HTMLElement).closest('#message-form') as HTMLFormElement | null
  if (!form) return
  e.preventDefault()
  let data = new FormData(form)
  fetch(form.action, { method: 'POST', body: data, redirect: 'manual' })
  let textarea = form.querySelector('textarea')
  if (textarea) textarea.value = ''
})
```

The server still returns a 302 redirect (to `Location: /messages`), but `redirect: 'manual'` prevents the browser from following it, keeping the Frame and SSE connection intact.

**Why event delegation works**: `document.addEventListener('submit', handler)` registers the listener on the document itself, not on a specific element. The `closest('#message-form')` filter checks if the submit originated from inside the target form. Even when the Frame's content is replaced via `innerHTML`, the document-level listener persists — it just checks the new form element instead.

### 3. Broadcast Updates All Connected Clients

After a POST handler creates a new message, it broadcasts to all SSE clients:

```typescript
// app/lib/messages-sse.ts
export const sseClients = new Set<ReadableStreamDefaultController>()

export function broadcastInvalidate(): void {
  let payload = JSON.stringify({})
  let dead: ReadableStreamDefaultController[] = []

  // First pass: collect dead controllers
  for (let controller of sseClients) {
    try {
      controller.enqueue(
        new TextEncoder().encode(`event: invalidate\ndata: ${payload}\n\n`),
      )
    } catch {
      dead.push(controller)
    }
  }

  // Second pass: delete dead controllers (NEVER delete from Set during iteration)
  for (let controller of dead) {
    sseClients.delete(controller)
  }
}
```

### 4. Controller Structure

```
app/actions/
├── messages/controller.tsx    ← Directory with controller.tsx (multi-action: index + POST)
├── messages-content.tsx      ← Flat file (single-action GET)
├── messages-subscribe.tsx    ← Flat file (single-action GET for SSE)
```

The multi-action `messages` route uses a directory with `controller.tsx`. The SSE subscribe endpoint is a flat file since it has a single GET action.

## Double-Chunk Workaround & Heartbeat

In the SSE `start()` callback, enqueue TWO chunks:

1. A `connected` event with JSON data
2. A `: heartbeat` comment line

This works around `sendResponse`'s double-read behavior. Without both chunks, the first frame read may not flush properly.

The `: heartbeat` comment serves double duty:
- **sendResponse workaround**: Satisfies the double-read requirement
- **Proxy keepalive**: Keeps idle connections from being closed by nginx, Cloudflare, etc.

For longer-lived connections, a periodic `setInterval` (every 30s) sends additional heartbeat comments to prevent proxy timeouts throughout the session, not just on connect.

## Safe Set Iteration

When iterating over SSE client Sets/Maps to broadcast messages, **never delete from the collection during iteration**:

```typescript
// ❌ WRONG: deleting from Set during forEach
sseClients.forEach((controller) => {
  try { controller.enqueue(data) }
  catch { sseClients.delete(controller) }  // undefined behavior
})

// ✅ RIGHT: collect dead items first, delete in separate loop
let dead: ReadableStreamDefaultController[] = []
for (let controller of sseClients) {
  try { controller.enqueue(data) }
  catch { dead.push(controller) }
}
for (let controller of dead) {
  sseClients.delete(controller)
}
```

**Why**: `Set.prototype.forEach` and `Map.prototype.forEach` have undefined behavior when the collection is mutated during iteration. With `for...of`, deleting during iteration causes skipped or duplicated entries. The collect-then-delete pattern is safe regardless of iteration method.

## Related

- `guides/sse-implementation.md` — Server-side SSE setup (ReadableStream, broadcast, heartbeat, abort)
- `guides/client-side-sse.md` — EventSource client patterns
- `guides/client-entry-side-effects.md` — Side-effect-only clientEntry that hosts EventSource
- `guides/split-controllers.md` — Flat file vs directory controller convention

## Codebase References

- `my_app/app/assets/messages-client.ts` — EventSource + form interception inside Frame
- `my_app/app/actions/messages-subscribe.tsx` — SSE ReadableStream endpoint (modern: abort + heartbeat)
- `my_app/app/actions/messages/controller.tsx` — POST handler with broadcastInvalidate()
- `my_app/app/lib/messages-sse.ts` — Client tracking and broadcast (safe Set iteration)
- `my_app/app/actions/messages/fragment-page.tsx` — Frame fragment using MessagesClient
