<!-- Context: development/remix3/guides/client-side-sse | Priority: medium | Version: 1.3 | Updated: 2026-05-07 -->

# Client-Side SSE

EventSource patterns for consuming SSE streams in Remix 3.

## Basic Pattern

```typescript
let eventSource = new EventSource('/messages?room=general')

eventSource.addEventListener('broadcast', (e) => {
  let data = JSON.parse(e.data)
  addMessage(data)
})

eventSource.addEventListener('status', (e) => {
  updateStatus(JSON.parse(e.data))
})
```

---

## Key Points

- **EventSource**: Native browser API for SSE
- **Cleanup**: Use `onclose` or AbortSignal
- **Reconnection**: Automatic by default
- **Binary**: Not supported, use fetch for binary data

---

## Cleanup Pattern

```typescript
let eventSource = new EventSource('/messages')

eventSource.onclose = () => {
  // Clean up connections
  eventSource = null
}

// Or with AbortSignal
let controller = new AbortController()
fetch('/messages', { signal: controller.signal })
```

---

---

## Clean SSE with clientEntry

For SSE connections that must survive frame navigation and page updates, use `clientEntry` with `handle.queueTask` + `addEventListeners` + `handle.signal`:

```typescript
import { clientEntry, addEventListeners, type Handle } from 'remix/ui'

export const MessageStream = clientEntry(
  import.meta.url,
  function MessageStream(handle: Handle<{ streamUrl: string }>) {
    return () => {
      let { streamUrl } = handle.props
      // queueTask runs after the component is mounted in the DOM
      handle.queueTask(() => {
        let eventSource = new EventSource(streamUrl)

        // addEventListeners auto-cleans on handle.signal abort
        addEventListeners(eventSource, handle.signal, {
          message(event: MessageEvent) {
            // ... process event data ...
            handle.update() // trigger re-render with new data
          },
          connected(event: MessageEvent) {
            // ... handle initial connection event ...
          },
        })

        // Close EventSource on unmount
        handle.signal.addEventListener('abort', () => {
          eventSource.close()
        })
      })

      return null // Side-effect only — no visible UI
    }
  },
)
```

**Why this pattern is clean**:
- `handle.queueTask(fn)` — Ensures the DOM is ready before creating EventSource
- `addEventListeners(target, signal, handlers)` — Registers listeners with automatic cleanup on unmount (no manual `removeEventListener`)
- `handle.signal` — Aborted when the component unmounts; used both by `addEventListeners` and for explicit `eventSource.close()`

**Comparison**:

| Aspect | Module-level `initialized` flag (old) | `handle.queueTask` + `handle.signal` (new) |
|--------|---------------------------------------|---------------------------------------------|
| Guard mechanism | Manual flag + `typeof document` check | Framework-provided lifecyle hooks |
| Cleanup | Manual `onclose` or AbortController | Automatic via `handle.signal` |
| Render guard | Manual | Built into `queueTask` |
| Readability | Requires explanation | Self-documenting |

> **See also**: `ui/guides/client-entry-side-effects.md` — Side-effect-only clientEntry patterns, `sse/guides/sse-in-frames.md` — SSE inside Frame fragments with form interception.

## Reference

- SSE server: `guides/sse-implementation.md`
- E2E encryption: `../sse/lookup/e2e-encryption.md`
- clientEntry patterns: `ui/guides/client-entry-side-effects.md`
- SSE in frames: `sse/guides/sse-in-frames.md`
