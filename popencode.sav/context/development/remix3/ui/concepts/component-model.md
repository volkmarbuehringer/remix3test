# Component Model

**Core Idea**: Two-phase component system. Setup runs once, render runs on every update. Components receive a `Handle` as their first argument.

**Key Points**:
- Setup phase: initializes state, event listeners, SDK instances — runs once per component lifetime
- Render phase: returned function runs on initial render and every `handle.update()` call
- `handle.props` is stable across updates — values are refreshed before each render, not captured at setup
- No `setup` prop anymore — use `handle.props` directly from the component function to initialize state
- Component removal aborts `handle.signal` and auto-cleans `addEventListeners()` listeners

**Minimal Example**:
```tsx
function Counter(handle: Handle<{ initialCount?: number }>) {
  let count = handle.props.initialCount ?? 0

  return () => (
    <div>
      Count: {count}
      <button mix={[on('click', () => { count++; handle.update() })]}>+</button>
    </div>
  )
}
```

**Reference**: `~/remix/packages/ui/docs/components.md`, `~/remix/packages/ui/docs/component.md`
