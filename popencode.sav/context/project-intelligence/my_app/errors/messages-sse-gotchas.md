<!-- Context: project-intelligence/my_app/errors | Priority: high | Version: 1.0 | Updated: 2026-05-10 -->

# Error: Multi-Client SSE Gotchas

**Root cause**: SSE connections with multiple browser tabs create a vicious cycle when lifecycle management is incomplete.

## The Vicious Cycle

```
No periodic heartbeat
  → proxies close idle connections after 30-60s
    → EventSource reconnects automatically
      → new ReadableStream controller created per reconnect
        → old controller NOT reliably cleaned up
          → sseClients Set accumulates stale entries
            → broadcastInvalidate() iterates growing stale set
              → worse with N tabs = N reconnection loops
```

---

## 1. ❌ No Periodic Heartbeat

**Symptom**: SSE connection drops after 30-60 seconds of inactivity. EventSource reconnects repeatedly, creating a new controller each time.

**Root cause**: Proxies (nginx, Cloudflare, AWS ELB) close idle HTTP connections. Without bytes flowing, the connection is assumed dead.

**Fix**: Send `: heartbeat\n\n` SSE comments at regular intervals:

```typescript
let keepAlive = setInterval(() => {
  try {
    controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`))
  } catch {
    clearInterval(keepAlive)
    sseClients.delete(controller)
  }
}, 30_000)
```

**Codebase reference**: `my_app/app/actions/messages-subscribe.tsx` lines 34-41

---

## 2. ❌ ReadableStream.cancel() Is Not Reliable

**Symptom**: `sseClients` Set grows unboundedly. Stale controllers accumulate and are never removed.

**Root cause**: `ReadableStream.cancel()` is not guaranteed to fire in all environments or scenarios (abrupt tab close, network partition, browser throttling background tabs).

**Fix**: Use `request.signal.addEventListener('abort', callback)` as the **primary** cleanup mechanism. This fires reliably when the HTTP connection drops:

```typescript
request.signal.addEventListener('abort', () => {
  clearInterval(keepAlive)
  sseClients.delete(controller)
  try { controller.close() } catch { /* stream may already be closed */ }
})
```

Keep `cancel()` as a fallback:

```typescript
cancel() {
  clearInterval(keepAlive)
  sseClients.delete(controller)
},
```

**Codebase reference**: `my_app/app/actions/messages-subscribe.tsx` lines 43-58

---

## 3. ❌ Unsafe Set Iteration During Broadcast

**Symptom**: `broadcastInvalidate()` throws intermittently or silently fails when iterating the SSE client Set. Stale controllers are not cleaned up.

**Root cause**: Deleting from a `Set` during iteration. Both `Set.prototype.forEach` and `for...of` have undefined/corrupt behavior when the collection is mutated mid-iteration.

```typescript
// ❌ WRONG: deleting from Set during iteration
sseClients.forEach((controller) => {
  try { controller.enqueue(data) }
  catch { sseClients.delete(controller) }  // undefined behavior
})

// ❌ ALSO WRONG (for...of version)
for (let controller of sseClients) {
  try { controller.enqueue(data) }
  catch { sseClients.delete(controller) }  // skipped/duplicated entries
}
```

**Fix**: Collect dead controllers in an array first, then delete them in a separate loop:

```typescript
let dead: ReadableStreamDefaultController[] = []
for (let controller of sseClients) {
  try { controller.enqueue(data) }
  catch { dead.push(controller) }
}
for (let controller of dead) {
  sseClients.delete(controller)
}
```

**Codebase reference**: `my_app/app/lib/messages-sse.ts` lines 16-29

---

## 4. ❌ Direct Event Listeners Lost on DOM Replacement

**Symptom**: After Frame content refreshes (via `innerHTML`), form submission stops working. EventSource events are still received but no longer trigger DOM updates.

**Root cause**: Frame content is replaced via `innerHTML` or `outerHTML`, which destroys all child elements and their attached event listeners. Direct `element.addEventListener('submit', handler)` is lost.

**Fix**: Use event delegation — attach listeners to `document` and filter with `closest()`:

```typescript
// ❌ WRONG: lost when Frame content is replaced
document.getElementById('message-form')?.addEventListener('submit', handler)

// ✅ RIGHT: survives DOM swaps
document.addEventListener('submit', (e) => {
  let form = (e.target as HTMLElement).closest('#message-form') as HTMLFormElement | null
  if (!form) return
  // ... handle submission ...
})
```

This applies to ALL interactivity inside Frames:
- Form submissions → `document.addEventListener('submit', ...)` + `closest()`
- Pagination/sort clicks → `document.addEventListener('click', ...)` + `closest('[data-*]')`
- Inline editing → `document.addEventListener` for blur/change/click events

**Why event delegation works**: The listener is on `document` itself — it never gets destroyed. When a DOM event bubbles up, the `closest()` check is performed against the current live DOM tree, which includes any newly inserted elements.

**Codebase reference**: `my_app/app/assets/messages-client.ts` lines 29-36 (pagination), 49-59 (form submit)

---

## Summary Table

| Pitfall | Symptom | Fix | Key Code |
|---------|---------|-----|----------|
| No heartbeat | Connection drops, reconnect loops | `setInterval` every 30s | `messages-subscribe.tsx:34-41` |
| `cancel()` unreliable | Stale controllers accumulate | `request.signal.addEventListener('abort')` | `messages-subscribe.tsx:43-53` |
| Unsafe Set iteration | Intermittent broadcast failures | Collect dead first, delete in separate loop | `messages-sse.ts:16-29` |
| Direct event listeners | Lost on Frame refresh | Event delegation + `closest()` | `messages-client.ts:49-59` |

## Codebase References

- `my_app/app/lib/messages-sse.ts` — SSE module: safe Set iteration
- `my_app/app/actions/messages-subscribe.tsx` — SSE endpoint: abort handler + heartbeat
- `my_app/app/assets/messages-client.ts` — clientEntry: event delegation, error handler

## Related

- `development/remix3/sse/guides/sse-in-frames.md` — SSE in Frames patterns
- `development/remix3/sse/guides/sse-implementation.md` — Generic SSE patterns (heartbeat, abort, safe iteration)
- `project-intelligence/my_app/guides/messages-with-frames.md` — How-to guide
- `project-intelligence/my_app/concepts/messages-architecture.md` — Architecture
- `development/remix3/sse/guides/sse-server-implementation.md` — Reference demo patterns
