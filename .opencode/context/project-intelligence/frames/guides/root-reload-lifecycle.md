# Guide: Root Reload Entry Lifecycle

## Purpose

How client entries behave during document-level reloads via
`handle.frames.top.reload()`, including persistence, cleanup, and
post-hydration setup.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Persistent entry** | A client entry present in both old and new HTML. Keeps local state across reload. Receives fresh server props. |
| **Removable entry** | A client entry present in old HTML but absent from new HTML. Gets disposed with abort callback. |
| **Abort handler** | `handle.signal.addEventListener('abort', ...)` — runs cleanup logic when entry is removed. |
| **Queue task** | `handle.queueTask(() => ...)` — runs a callback after the first client-side render (hydration). Only fires once per hydration cycle, never during SSR. |

## Lifecycle Flow

```
Document Load / Re-load
  │
  ▼
SSR: server renders HTML with client entry markers (rmx:h:)
  │
  ▼
Hydration: client entry mounts, runs initial render
  │
  ├── handle.queueTask() fires → "setup" runs once
  │
  ▼
Root reload triggered (handle.frames.top.reload())
  │
  ├── New HTML arrives
  ├── Diff algorithm compares old vs new
  │
  ├── Entry in both old + new → PERSISTENT
  │   ├── Keeps local state (variables, closures)
  │   └── Receives new server props from new HTML
  │
  └── Entry in old but NOT new → REMOVABLE
      ├── abort handler fires → cleanup logic runs
      └── Entry removed from DOM
```

## Patterns in newapp

### Persistent Counter (admin sidebar)

`app/assets/persistent-admin-counter.tsx` demonstrates both lifecycle hooks:

```tsx
export const PersistentAdminCounter = clientEntry(
  import.meta.url,
  function PersistentAdminCounter(handle: Handle) {
    let localCount = 0   // ← persists across root reload
    let setupId = 0

    // Post-hydration setup — runs once after first client render
    handle.queueTask(() => {
      setupId++
      handle.update()
    })

    // Cleanup handler — fires on removal/disposal
    handle.signal.addEventListener('abort', () => {
      console.info('Entry disposed — cleanup here')
    })

    return () => (
      <div>
        <button on:click={() => { localCount++; handle.update() }}>+</button>
        <span>{localCount}</span>
        <span>setup: #{setupId}</span>
      </div>
    )
  },
)
```

### View Toggle with Root Reload

`app/assets/admin-view-toggle.tsx` navigates between admin views via
document-level reload:

```tsx
async function reloadTopFrame(src: string) {
  handle.frames.top.src = src
  let signal = await handle.frames.top.reload()
  if (signal.aborted) return
}
```

The toggle itself is a persistent entry — it survives the root reload and
keeps its pending state flag. The abort handler would clean up any
event listeners or timers if the entry were ever removed.

## Key Points

- **`handle.queueTask()` only fires during hydration**, not on subsequent
  updates. Use it for one-time setup like measuring DOM, restoring scroll
  position, or initializing third-party libraries.
- **`abort` is the only cleanup mechanism**. There's no `unmount` or
  `dispose` callback — attach via `handle.signal.addEventListener('abort')`.
- **Persistent entries keep ALL local state** (closures, variables). They
  receive fresh props from the new HTML but nothing else resets.
- **Removable entries are detected by the diff algorithm**. If the entry
  is absent from the new HTML, it's treated as removed and disposed.

## See Also

- `concepts/frame-boundary-hydration.md` — why entries inside frames
  don't re-hydrate
- `guides/client-entry-in-paginated-lists.md` — handling props in
  interactive entries
- `examples/books1-pagination.md` — frame-based pagination patterns
