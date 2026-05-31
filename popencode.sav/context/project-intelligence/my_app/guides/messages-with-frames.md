<!-- Context: project-intelligence/my_app/guides | Priority: high | Version: 1.1 | Updated: 2026-05-10 -->

# Guide: Messages with Frames, SSE & clientEntry

**Purpose**: Build a realtime feature using Frame + SSE + clientEntry composition.

## Step 1: Define Routes

```typescript
messages: route('messages', {
  index: get('/'),       // GET /messages — page shell
  action: post('/'),     // POST /messages — form action
}),
messagesContent: get('/messages/content'),    // GET fragment for Frame
messagesSubscribe: get('/messages/subscribe'), // GET SSE endpoint
```

**Convention**: Multi-action → directory controller. Single-action → flat file with named export (`messages-content.tsx`, `messages-subscribe.tsx`).

## Step 2: Page Shell with Frame

```typescript
// controller.tsx — directory, middleware + actions
export default {
  middleware: [requireAuth()],
  actions: {
    async index() { return render(<MessagesPage />) },
    async action() { /* sanitize → db.create() → broadcastInvalidate() → redirect */ },
  },
}

// page.tsx — Frame points to separate fragment route
function MessagesPage() {
  return () => (
    <Layout title="Messages">
      <Frame name="messages-content" src="/messages/content" fallback={<p>Loading...</p>} />
    </Layout>
  )
}
```

**Key**: Frame loads `/messages/content` independently — NOT the same as the page shell route. v2 pattern: single `src` param, no `x-remix-target`.

## Step 3: Fragment Handler

```typescript
// messages-content.tsx — flat, named export
export const messagesContent: BuildAction<'GET', typeof routes.messagesContent> = {
  async handler() {
    if (!getCurrentUserSafely()) return redirect('/login')
    let allMessages = await getAllMessages()  // JOIN messages + users
    return renderFragment(<MessagesContent messages={allMessages} />)
  },
}
```

`renderFragment` adds `Cache-Control: no-store`, delegates to `render()`.

## Step 4: SSE Module + Endpoint

```typescript
// lib/messages-sse.ts — module-level state (Set + rate limiter)
export const sseClients = new Set<ReadableStreamDefaultController>()

export function broadcastInvalidate(): void {
  let payload = JSON.stringify({})
  let dead: ReadableStreamDefaultController[] = []
  // First pass: collect dead controllers
  for (let ctrl of sseClients) {
    try { ctrl.enqueue(new TextEncoder().encode(`event: invalidate\ndata: ${payload}\n\n`)) }
    catch { dead.push(ctrl) }
  }
  // Second pass: delete dead controllers (never delete from Set during iteration)
  for (let ctrl of dead) {
    sseClients.delete(ctrl)
  }
}

// messages-subscribe.tsx — flat SSE endpoint with modern lifecycle management
export const messagesSubscribe = createAction<typeof routes.messagesSubscribe, AppContext>(
  routes.messagesSubscribe,
  ({ request }) => {
    if (!getCurrentUserSafely()) {
      return new Response(null, { status: 302, headers: { Location: routes.authLogin.index.href() } })
    }

    let controller: ReadableStreamDefaultController
    let keepAlive: ReturnType<typeof setInterval> | undefined

    let stream = new ReadableStream({
      start(enqueueController) {
        controller = enqueueController
        sseClients.add(controller)

        // Connected event (+ satisfies sendResponse double-read workaround)
        controller.enqueue(new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`))

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
          try { controller.close() } catch { /* stream may already be closed */ }
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
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  },
)
```

**Module-level state**: SSE client Set + rate limiter Map in shared module — no DB polling.

**Three new patterns in this code**:
1. **`request.signal.addEventListener('abort', ...)`** — Primary cleanup mechanism. Fires reliably when HTTP connection drops (tab close, network failure). Redundant with `cancel()` but critical for environments where `cancel()` is not called.
2. **`setInterval` heartbeat** — Prevents proxy timeouts. Without it, proxies close idle connections after 30-60s, triggering reconnect loops.
3. **Safe Set iteration** — Collect dead controllers in an array first, delete them in a second loop. Never delete from a Set during iteration.

## Step 5: clientEntry Side-Effects in Frame

```typescript
export const MessagesClient = clientEntry(
  import.meta.url,
  function MessagesClient(_handle: Handle) {
    let initialized = false
    let currentOffset = 0

    return ({ containerId }: { containerId: string }) => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        // 1) Pagination: event delegation survives DOM swaps from page refreshes
        document.addEventListener('click', (e) => {
          let btn = (e.target as HTMLElement).closest('[data-pagination]') as HTMLElement | null
          if (!btn) return
          let offset = btn.getAttribute('data-offset')
          if (offset === null) return
          currentOffset = Number(offset)
          fetchPage(containerId, currentOffset)
        })

        // 2) SSE trigger: refresh current page when invalidate event fires
        let eventSource = new EventSource('/messages/subscribe')
        eventSource.addEventListener('invalidate', () => {
          fetchPage(containerId, currentOffset)
        })
        eventSource.addEventListener('error', () => {
          // EventSource auto-reconnects on connection loss.
          // The server-side heartbeat (every 30s) keeps the connection alive.
        })

        // 3) Form interception via event delegation (survives DOM swaps).
        //    Direct form.addEventListener() would be lost when Frame content is replaced.
        document.addEventListener('submit', (e) => {
          let form = (e.target as HTMLElement).closest('#message-form') as HTMLFormElement | null
          if (!form) return
          e.preventDefault()
          let data = new FormData(form)
          fetch(form.action, { method: 'POST', body: data, redirect: 'manual' })
          let textarea = form.querySelector('textarea')
          if (textarea) textarea.value = ''
        })
      }
      return null  // No UI — side effects only
    }
  },
)
```

**Three-guard pattern**: `initialized` flag + `typeof document !== 'undefined'` (SSR guard) + return `null` (no DOM). Props target SSR-rendered DOM.

**Key client-side patterns**:
- **Event delegation** (`document.addEventListener` + `closest()`) — All listeners survive `innerHTML` replacements from Frame content refreshes. Direct `form.addEventListener()` or `button.addEventListener()` would be lost.
- **`invalidate` event** — Client receives a lightweight "something changed" signal, then re-fetches content via `fetchPage()`. The server doesn't send the actual data — just a trigger to re-query.
- **`error` event listener** — Explicit handler ensures observability. EventSource auto-reconnects by default, so no manual reconnect logic needed.

## Cross-cutting Concerns

| Concern | Solution |
|---------|----------|
| Auth on flat fragment | Inline `getCurrentUserSafely()` check |
| Rate limiting | Module-level Map + cleanup interval |
| Input sanitization | Strip control chars, max 1000 chars |
| SSE cleanup (primary) | `request.signal.addEventListener('abort', ...)` — fires on HTTP disconnect |
| SSE cleanup (fallback) | `ReadableStream.cancel()` — not reliable in all environments |
| Proxy timeouts | `setInterval` heartbeat every 30 seconds |
| Stale controller accumulation | Safe Set iteration (collect dead, delete in separate loop) |
| Lost event listeners on DOM replace | Event delegation via `document.addEventListener` + `closest()` |

## Codebase References
- `my_app/app/routes.ts` — Route definitions
- `my_app/app/router.ts` — Router wiring
- `my_app/app/actions/messages/controller.tsx` — Page shell controller (calls `broadcastInvalidate()`)
- `my_app/app/actions/messages-content.tsx` — Fragment handler
- `my_app/app/actions/messages-subscribe.tsx` — SSE endpoint (modern: abort + heartbeat)
- `my_app/app/lib/messages-sse.ts` — SSE module (safe Set iteration)
- `my_app/app/lib/messages-sse.test.ts` — SSE module tests (5 tests)
- `my_app/app/assets/messages-client.ts` — clientEntry (event delegation, EventSource error handler)
- `my_app/app/utils/render.tsx` — render, renderFragment, resolveClientEntry

## Related
- `development/remix3/sse/guides/sse-in-frames.md` — SSE in Frames patterns
- `development/remix3/sse/guides/sse-implementation.md` — Generic SSE patterns
- `development/remix3/guides/frames.md` — Frame overview
- `development/remix3/guides/render-utilities.md` — renderFragment
- `development/remix3/guides/client-entry-routes.md` — Full-page clientEntry
- `project-intelligence/frames/errors/missing-resolve-client-entry.md` — clientEntry not resolving in fragments
- `project-intelligence/frames/errors/security-file-uri-s.md` — file:// URI issues in browser
- `project-intelligence/frames/errors/invalid-url-framesrc-empty.md` — frameSrc missing in fragments
- `project-intelligence/frames/errors/missing-unique-frame-names.md` — State leak without unique names
- `project-intelligence/my_app/concepts/messages-architecture.md`
- `project-intelligence/my_app/errors/messages-sse-gotchas.md` — Multi-client SSE pitfalls
