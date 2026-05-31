<!-- Context: development/remix3/sse/guides/connection-indicator | Priority: medium | Version: 1.2 | Updated: 2026-05-28 -->

# SSE Connection Status Indicator

A `clientEntry` component that visualizes the state of an SSE `EventSource` connection
with a colored dot and status text. Supports two reload modes and conditional reload suppression.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | required | SSE endpoint URL to subscribe to |
| `reloadMode` | `'frame' \| 'window'` | `'frame'` | How to reload on `invalidate`: `'frame'` calls `handle.frame.reload()` (inside a Remix Frame); `'window'` calls `window.location.reload()` (standalone page) |
| `skipReloadParams` | `string[]` | `[]` | URL search param names that suppress the `invalidate`→reload behavior when present (e.g., `['editing', 'creating']`) |

## Usage

### Inside a Frame (admin pages)
```tsx
<ConnectionIndicator
  url="/admin/appointments/events"
  reloadMode="frame"
  skipReloadParams={['editing', 'creating']}
/>
```

### On a standalone page (public appointment page)
```tsx
<ConnectionIndicator
  url="/appointment/events"
  reloadMode="window"
/>
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
4. **Invalidate** — `event: invalidate` triggers reload per `reloadMode`, unless a
   `skipReloadParams` param is present in the URL
5. **Cleanup** — `handle.signal.addEventListener('abort')` calls `eventSource.close()`

## Invalidation Pattern

The indicator listens for `event: invalidate` and reloads according to `reloadMode`.
This pairs with server-side channels that broadcast `invalidate` after data mutations.

```typescript
// Server: after creating/deleting/updating data
appointmentChannel.broadcast('invalidate')

// Client: ConnectionIndicator's 'invalidate' listener
//   reloadMode='frame'  → handle.frame.reload()
//   reloadMode='window' → window.location.reload()
```

**Double reload acceptance**: Some pages also call `window.location.reload()` directly
in their mutation handler (e.g., `handleMutationResponse` in `appointment-grid.tsx`).
When the SSE `invalidate` arrives around the same time, the second reload is a harmless
no-op during page navigation. This is an accepted tradeoff — the `invalidate` broadcast
ensures other sessions see updates even if the mutating session already reloaded.

## Positioning Patterns

### Sticky bar (public page, standalone)
The indicator is placed in a sticky bar at the top of the content area so it stays
visible when the user scrolls:

```tsx
const indicatorBarStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 10,
  display: 'flex',
  justifyContent: 'flex-end',
  background: theme.surface.lvl0,
  pointerEvents: 'none',     // allow clicks to pass through
  '& > *': {
    pointerEvents: 'auto',   // but keep indicator interactive
  },
})
```

### Header bar (admin page, inside Frame)
The indicator sits next to the page title in a flex header bar, in-flow (no sticky):

```tsx
<div mix={headerBarStyle}>
  <h2>Appointments</h2>
  <ConnectionIndicator url="/admin/appointments/events" reloadMode="frame" />
</div>
```

## Styling

The indicator is self-contained with inline styles via `css()`. It uses:
- Pill-shaped container with `display: inline-flex`, no background fill
- 8px colored dot with pulse keyframe animation (except `disconnected`)
- `aria-live="polite"` and `aria-label` for accessibility

## Codebase References

- **Component**: `newapp/app/assets/connection-indicator.tsx` — 152 lines
- **Standalone page usage**: `newapp/app/ui/appointment-page.tsx` — sticky bar, `reloadMode: 'window'`
- **Frame page usage**: `newapp/app/ui/admin-appointments-page.tsx` — header bar, `reloadMode: 'frame'`, `skipReloadParams: ['editing', 'creating']`
- **Frame page usage (messages)**: `newapp/app/ui/admin-messages-page.tsx` — header bar, `reloadMode: 'frame'`
- **Backend channels**:
  - `newapp/app/lib/appointments-sse.ts` — `appointmentChannel.broadcast('invalidate')` for both public and admin
  - `newapp/app/lib/messages-sse.ts` — `adminChannel.broadcast('invalidate')` for admin messages
- **Channel factory**: `newapp/app/lib/sse.ts` — `createChannel` implementation

## Related

- `concepts/channel-factory.md` — The `createChannel` factory that pairs with this indicator
- `guides/client-side-sse.md` — General EventSource client patterns
- `guides/sse-in-frames.md` — SSE inside Frame fragments
