<!-- Context: development/remix3/sse/guides/connection-indicator | Priority: medium | Version: 1.0 | Updated: 2026-05-18 -->

# SSE Connection Status Indicator

A `clientEntry` component that visualizes the state of an SSE `EventSource` connection
with a colored dot and status text.

## Usage

```tsx
import { ConnectionIndicator } from '../assets/connection-indicator.tsx'

// In a page component header:
<ConnectionIndicator url="/admin/messages/subscribe" />
```

## States

| State | Dot Color | Text | Pulse |
|-------|-----------|------|-------|
| `connecting` | Amber | "Connecting..." | ✅ |
| `connected` | Green | "Connected" | ✅ |
| `reconnecting` | Amber | "Reconnecting..." | ✅ |
| `disconnected` | Red | "Disconnected" | ❌ |

## Lifecycle

1. **Post-hydration setup** — `handle.queueTask()` creates `EventSource(url)`
2. **Open/connected** — Both `open` and `connected` events set state to `connected`
3. **Error** — If `readyState === CLOSED`, shows `disconnected`; otherwise `reconnecting`
   (EventSource auto-reconnects; this tracks the transient period)
4. **Invalidate** — `event: invalidate` triggers `handle.frame.reload()` so the page
   reflects latest server state
5. **Cleanup** — `handle.signal.addEventListener('abort')` calls `eventSource.close()`

## Invalidation Pattern

The indicator listens for `event: invalidate` and reloads the parent frame when
received. This pairs with server-side channels that broadcast `invalidate` after
data mutations:

```typescript
// Server: after creating/deleting data
adminChannel.broadcast('invalidate')

// Client: ConnectionIndicator's 'invalidate' listener
handle.frame.reload()
```

## Styling

The indicator is self-contained with inline styles via `css()`. It uses:
- Pill-shaped container with `display: inline-flex`, no background fill
- 8px colored dot with pulse keyframe animation (except `disconnected`)
- `aria-live="polite"` and `aria-label` for accessibility

## Codebase References

- **Component**: `newapp/app/assets/connection-indicator.tsx` — 130 lines
- **Usage**: `newapp/app/ui/admin-messages-page.tsx` — Shown in page header
- **Backend channel**: `newapp/app/lib/messages-sse.ts` — `adminChannel.broadcast('invalidate')`

## Related

- `concepts/channel-factory.md` — The `createChannel` factory that pairs with this indicator
- `guides/client-side-sse.md` — General EventSource client patterns
- `guides/sse-in-frames.md` — SSE inside Frame fragments
