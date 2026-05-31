<!-- Context: development/remix3/guides | Priority: high | Version: 1.1 | Updated: 2026-05-06 -->

# Handle API

The `Handle` object is the component's interface to the framework.

## Core Idea

Handle provides methods to trigger updates, queue post-render tasks, manage component lifecycle, and access context.

## Key Points

- `handle.update()` - Schedules update, returns `AbortSignal` that resolves after update
- `handle.queueTask(fn)` - Runs task after next render (for DOM operations)
- `handle.signal` - `AbortSignal` aborted on unmount (use for cleanup)
- `handle.frames.top` - Root frame; `handle.frames.get(name)` - Named frame lookup
- `handle.id` - Stable instance identifier (for `htmlFor`, `aria-owns`)
- `handle.context` - Context API (see Context API concept) — **only works in `clientEntry` components**
- `addEventListeners(target, signal, handlers)` - Auto-cleanup event listening

## ⚠️ Frame Reload Warning

`handle.frames.top.reload()` **only works for top-level frames** where `container.root instanceof Document`.

- **Top-level frames**: Frame IS the document — `reload()` works correctly
- **Embedded frames**: Frame is an Element (e.g., `<div>`) — `reload()` **crashes** with `DOMException: Cannot have more than one Element child of a Document`

**Why**: `reload()` calls `render()` which checks `isFullDocumentHtml()`. If true (which `renderToStream()` always returns), it uses `diffNodes()` on `document.head` and `document.body` — this fails on embedded frames.

**For embedded frames**, use manual fetch + innerHTML swap instead:
```typescript
// ✅ Safe pattern for embedded frames
fetch(url, { credentials: 'same-origin' })
  .then(r => r.text())
  .then(html => { document.getElementById('my-frame').innerHTML = html })
```

See `ui/concepts/frame-reload-paths.md` for full details on reload paths.

## Quick Example

```tsx
function Counter(handle) {
  let count = 0

  return () => (
    <button onClick={() => { count++; handle.update() }}>
      Count: {count}
    </button>
  )
}

function KeyboardTracker(handle) {
  let keys: string[] = []
  addEventListeners(document, handle.signal, {
    keydown(e) { keys.push(e.key); handle.update() },
  })
  return () => <div>{keys.join(', ')}</div>
}
```

## Reference

`/home/lucky/remix/packages/component/docs/handle.md`