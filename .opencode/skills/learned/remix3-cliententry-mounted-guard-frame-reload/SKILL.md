---
name: remix3-cliententry-mounted-guard-frame-reload
description: "Fix mounted guards in clientEntry closures that break after Frame navigation"
origin: auto-extracted
---

# `let mounted = false` in clientEntry Breaks After Frame Reload

**Extracted:** 2026-06-17
**Context:** All admin context menus stopped working after sort/paginate/filter in a Remix 3 Frame-based admin panel. The root cause was a `let mounted = false` guard in each `clientEntry` closure that prevented re-attaching event listeners after Frame DOM replacement.

## Problem

A `clientEntry` uses `let mounted = false` to prevent duplicate event listener registration:

```typescript
export const MyInteractive = clientEntry(
  import.meta.url + '#MyInteractive',
  function MyInteractive(handle: Handle) {
    let mounted = false

    return () => {
      let el = document.getElementById('my-element')
      if (!mounted && el) {
        mounted = true
        el.addEventListener('click', handler, { signal: handle.signal })
      }
      return <div />
    }
  },
)
```

After Frame-targeted navigation (sort, paginate, filter), the interactive behavior silently stops working because:

1. The Frame's DOM content is replaced with new HTML from the server
2. The `clientEntry` factory closure is **preserved** across Frame updates — only the render function re-runs
3. `mounted` is still `true` from the initial hydration, so the listener attachment is skipped
4. The new DOM nodes have no event listeners → component silently broken

## Solution

Replace the `mounted` guard with one of three patterns depending on the component architecture:

### Pattern A: `ref()` with per-insertion AbortSignal

For components that render a DOM element (e.g., a hidden trigger div) inside the `clientEntry`'s JSX return value. The `ref()` mixin fires on every DOM insertion and provides an `AbortSignal` for cleanup:

```typescript
export const MyInteractive = clientEntry(
  import.meta.url + '#MyInteractive',
  function MyInteractive(handle: Handle) {
    return () => (
      <div
        mix={ref((el, signal) => {
          let table = document.getElementById('my-table')
          if (!table) return

          function onContextMenu(event: Event) {
            // ... handler logic ...
          }

          table.addEventListener('contextmenu', onContextMenu, { capture: true })
          signal.addEventListener('abort', () => {
            table.removeEventListener('contextmenu', onContextMenu)
          })
        })}
      />
    )
  },
)
```

`ref()` fires on every DOM insertion (initial hydration AND Frame replacement). The ref's `signal` fires when the element is removed (Frame navigation cleans up old listeners eagerly).

### Pattern B: Table-identity tracking with AbortController

For components that query a **server-rendered** DOM element (not rendered by the clientEntry's return value). Track the DOM node identity and use a per-attachment `AbortController`:

```typescript
export const MyInteractive = clientEntry(
  import.meta.url + '#MyInteractive',
  function MyInteractive(handle: Handle) {
    let currentTable: HTMLElement | null = null
    let attachController: AbortController | null = null

    handle.signal.addEventListener('abort', () => {
      attachController?.abort()
    })

    return () => {
      let table = typeof document !== 'undefined'
        ? document.getElementById('my-table')
        : null
      if (table && table !== currentTable) {
        attachController?.abort()
        attachController = new AbortController()
        currentTable = table

        table.addEventListener('click', onClick, { signal: attachController.signal })
      }

      return <div />
    }
  },
)
```

On each render, compare the current DOM node against the cached reference. If different (Frame replaced the DOM), abort the old controller (removes old listeners) and attach fresh ones.

### Pattern C: Remove `mounted` guard from existing `ref()` callbacks

For `ref()` callbacks that already exist but are guarded by `mounted`. The `ref()` only fires on actual DOM insertion (not on `handle.update()`), so removing the guard is safe:

```typescript
// Before (broken):
let mounted = false
ref((el) => {
  triggerRef = el
  if (mounted) return
  mounted = true
  table.addEventListener('contextmenu', onContextMenu)
  handle.signal.addEventListener('abort', () => {
    table.removeEventListener('contextmenu', onContextMenu)
  })
})

// After (fixed):
ref((el) => {
  triggerRef = el
  table.addEventListener('contextmenu', onContextMenu)
  handle.signal.addEventListener('abort', () => {
    table.removeEventListener('contextmenu', onContextMenu)
  })
})
```

The `mounted` guard is unnecessary for `ref()` callbacks because:
- `ref()` fires only on DOM insertion (not on `handle.update()`)
- On Frame navigation, the old element is removed and a new one is inserted → `ref()` fires again
- `handle.signal` cleanup ensures no listener leaks when the component is disposed

## When to Use

- A `clientEntry` component with event listeners or DOM interactions silently stops working after Frame-targeted navigation (sort, paginate, filter)
- You see `let mounted = false` (or `let initialized = false`) guarding `addEventListener` or `document.getElementById` in a clientEntry
- Admin grid context menus, inline edit controls, or any interactive elements inside a Remix 3 `<Frame>`
