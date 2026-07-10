---
name: remix3-cliententry-drag-and-drop
description: 'Add HTML5 drag-and-drop to Remix 3 clientEntry components without infinite loops'
origin: auto-extracted
---

# HTML5 Drag and Drop in Remix 3 clientEntry

**Extracted:** 2026-07-01
**Context:** Implementing drag-and-drop reordering of list items in a `clientEntry` component

## Problem

Adding HTML5 Drag and Drop (`dragstart`, `dragover`, `drop`, `dragend`) to a Remix 3 `clientEntry` hits three issues:

1. **`on()` mixin rejects drag events** — `on('dragstart', handler)` fails TypeScript because `EventType<Element>` (the target type for JSX elements) does not include HTML5 drag events. Only `HTMLElementEventMap` includes them, but the template system targets `Element`.
2. **`handle.update()` during drag causes infinite loop** — calling `handle.update()` inside `dragover` (which fires on every mouse pixel) triggers a re-render, which the Remix scheduler detects as cascading updates and throws `Error: handle.update() infinite loop detected`.
3. **Stale closures after key-based reorder** — after a successful drop, `handle.update()` re-renders the list. Key-based reconciliation reuses DOM elements, so `ref()` callbacks **don't re-fire**. Event listener closures keep the **old** `index` value, corrupting subsequent drag operations.

## Solution

### 1. Use `ref()` + `addEventListener` instead of `on()`

Attach drag event listeners via `ref()` with an `AbortController` for cleanup:

```ts
import { clientEntry, ref, css } from 'remix/ui'

export const MyList = clientEntry(import.meta.url + '#MyList', (handle) => {
  let items = [...]

  let handleDragStart = (e: DragEvent, index: number) => { ... }
  let handleDragOver = (e: DragEvent, index: number) => { ... }
  let handleDrop = () => { ... }
  let handleDragEnd = () => { ... }

  return () => (
    <div>
      {items.map((item, index) => (
        <div
          key={item.id}
          mix={ref((el) => {
            let ac = new AbortController()
            el.addEventListener('dragstart', (e) => {
              let idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10)
              handleDragStart(e as DragEvent, idx)
            }, { signal: ac.signal })
            el.addEventListener('dragover', (e) => {
              let idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10)
              handleDragOver(e as DragEvent, idx)
            }, { signal: ac.signal })
            el.addEventListener('drop', (e) => handleDrop(e as DragEvent), { signal: ac.signal })
            el.addEventListener('dragend', () => handleDragEnd(), { signal: ac.signal })
            return () => ac.abort()
          })}
          draggable="true"
          data-index={index}
        >
          ...
        </div>
      ))}
    </div>
  )
})
```

### 2. Never call `handle.update()` during active drag

Visual feedback must use **direct DOM manipulation**:

```ts
let draggedEl: HTMLElement | null = null
let indicatorEl: HTMLElement | null = null

let handleDragStart = (e: DragEvent, index: number) => {
  let el = e.currentTarget as HTMLElement
  draggedEl = el
  el.style.opacity = '0.4'
}

let handleDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  e.stopPropagation()
  if (targetEl) targetEl.style.borderTop = '2px solid blue'
}

let handleDrop = () => {
  if (indicatorEl) indicatorEl.style.borderTop = ''
  items = reorderedItems
  handle.update()
}

let handleDragEnd = () => {
  let dirty = draggedEl !== null || indicatorEl !== null
  if (draggedEl) draggedEl.style.opacity = ''
  if (indicatorEl) indicatorEl.style.borderTop = ''
  if (dirty) handle.update()
}
```

### 3. Read `data-index` live from the DOM, not from closure

```ts
// ✅ Correct: read live from DOM
el.addEventListener(
  'dragover',
  (e) => {
    let idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10)
    handleDragOver(e as DragEvent, idx)
  },
  { signal: ac.signal },
)

// ❌ Wrong: captured in closure, stale after reorder
el.addEventListener('dragover', (e) => handleDragOver(e as DragEvent, index), { signal: ac.signal })
```

For container-level iteration, use `listRef.children[i]` (scoped, O(1)):

```ts
let listRef: HTMLDivElement | null = null

let elByIndex = (i: number): HTMLElement | null => {
  let child = listRef?.children[i]
  return child instanceof HTMLElement ? child : null
}
```

### 4. Set `draggable="false"` on interactive children

```tsx
<div draggable="false" mix={css({ display: 'flex', gap: '8px' })}>
  <button>Edit</button>
  <button>Delete</button>
</div>
```

## When to Use

- Implementing drag-and-drop reordering in a Remix 3 `clientEntry`
- Getting TypeScript errors when using `on('dragstart', ...)` or `on('dragover', ...)`
- Getting `handle.update() infinite loop detected` during drag operations
- Drag operations work once but break after reordering items
