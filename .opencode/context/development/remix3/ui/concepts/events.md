# Events

**Core Idea**: Event handling via the `on()` mixin with automatic signal-based interruption. No synthetic events — real DOM events.

**Key Points**:
- `on('click', handler)` — attach event listener via `mix={[...]}` prop
- Handler receives `(event, signal)` — signal aborted when handler re-entered or component removed
- Prevents race conditions in async handlers (stale search results, etc.)
- Multiple event types on same element: multiple `on()` mixins in the mix array
- `addEventListeners(target, handle.signal, listeners)` — global events with auto-cleanup
- Prefer native `click` on `<button>` over custom pointer handling for activation

**Minimal Example**:
```tsx
<input mix={[on('input', async (event, signal) => {
  let res = await fetch(`/search?q=${event.currentTarget.value}`, { signal })
  if (signal.aborted) return
  // update results
})]} />
```

**Reference**: `~/remix/packages/ui/docs/events.md`
