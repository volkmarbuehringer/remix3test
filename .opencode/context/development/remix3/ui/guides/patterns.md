# Patterns

**Core Idea**: Best practices for state management, focus/scroll, data loading, and controlled/uncontrolled inputs.

**Key Points**:
- **Minimal state**: only store what rendering needs; derive computed values in render
- **Don't store input state** you only need on submit — read from `FormData` directly in the event handler
- **Do work in event handlers** — use handler scope for transient state, capture only render-needed state
- **Setup scope** for one-time init (SDKs, maps, `addEventListeners`, timers)
- **queueTask** for post-render DOM ops (focus, scroll); `await handle.update()` for signal after update
- **Uncontrolled inputs** when only user controls value; **controlled** when programmatic changes needed
- **Data loading**: handler signals for fetch cancellation; `queueTask` in render for reactive prop-based loading

**Minimal Example**:
```tsx
// Derive computed values in render
function TodoList(handle: Handle) {
  let todos: Array<{ text: string; completed: boolean }> = []
  return () => {
    let completedCount = todos.filter(t => t.completed).length
    return <div>Completed: {completedCount}</div>
  }
}
```

**Reference**: `~/remix/packages/ui/docs/patterns.md`
