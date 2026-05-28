<!-- Context: development/remix3/guides | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# Events

Event handling with signal-based interruption and automatic cleanup.

## Core Idea

Use `on(eventType, handler)` mixin for element events; `addEventListeners(target, signal, handlers)` for global targets. Event handlers receive an `AbortSignal` for race condition prevention.

## Key Points

- `on('click', handler)` - Attach event listener; handler receives `(event, signal?)`
- Signal auto-aborts when handler re-entered or component unmounts
- Pass signal to `fetch()` or check `signal.aborted` after async work
- Prefer `press` events over `click` for cross-device compatibility
- `addEventListeners()` auto-cleans on component unmount

## Quick Example

```tsx
function Search(handle) {
  let results: string[] = []

  return () => (
    <input onInput={async (e, signal) => {
      let query = e.currentTarget.value
      let res = await fetch(`/search?q=${query}`, { signal })
      if (signal.aborted) return
      results = await res.json()
      handle.update()
    }} />
  )
}

function GlobalTracker(handle) {
  addEventListeners(window, handle.signal, {
    resize() { handle.update() },
  })
  return () => <div />
}
```

## Reference

`/home/lucky/remix/packages/component/docs/events.md`