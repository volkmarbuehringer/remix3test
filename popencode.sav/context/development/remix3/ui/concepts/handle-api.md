# Handle API

**Core Idea**: The `Handle` object is the component's interface to the framework — update scheduling, signal-based cleanup, frame navigation, and context.

**Key Points**:
- `handle.update()` — schedules re-render, returns `Promise<AbortSignal>` resolved after DOM update
- `handle.queueTask(task)` — runs callback after next render (for DOM operations like focus/scroll); task signal aborts on re-render or removal
- `handle.signal` — `AbortSignal` aborted when component is disconnected (for cleanup)
- `handle.frames.top.reload()` — reload the root frame from a nested component
- `handle.frames.get(name)` — look up adjacent named frames for cross-frame reloads
- `handle.id` — stable per-instance identifier for `htmlFor`, `aria-*`, etc.
- `handle.context` — ancestor/descendant communication via `set()`/`get()`

**Minimal Example**:
```tsx
function Player(handle: Handle) {
  let isPlaying = false
  let stopBtn: HTMLButtonElement

  return () => (
    <button disabled={isPlaying} mix={[
      ref(n => stopBtn = n),
      on('click', async () => { isPlaying = true; await handle.update(); stopBtn.focus() })
    ]}>Play</button>
  )
}
```

**Reference**: `~/remix/packages/ui/docs/handle.md`
