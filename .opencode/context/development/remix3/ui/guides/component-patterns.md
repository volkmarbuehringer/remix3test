<!-- Context: development/remix3/ui/guides | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Component Patterns

Common component patterns and best practices for the two-phase model.

## Canonical Component Form

All components must use the **Handle pattern** — the component function receives a `Handle<Props>` argument and returns a render function:

```tsx
function MyComponent(handle: Handle<MyComponentProps>) {
  // Setup phase: runs once per component lifetime
  // Initialize state, event listeners, SDK instances here
  let cache = new Map<string, any>()

  return () => {
    // Render phase: runs on initial render and every handle.update()
    let { title } = handle.props  // props are stable across updates
    return <div>{title}</div>
  }
}
```

### ❌ Never use the factory pattern

```tsx
// ❌ OLD — do not use
function MyComponent() {
  return (props: MyComponentProps) => <div>{props.title}</div>
}
```

The factory pattern creates a fresh props object every render, has no access to `handle.signal` for cleanup, and doesn't integrate with the remix 3 component model.

### ✅ Handle pattern is canonical

The `handle.props` object identity is stable across updates (values refresh before each render), the setup phase enables event listener registration with auto-cleanup via `handle.signal`, and the pattern is consistent with the remix 3 component model.

### Case study

The newapp project migrated 18 components from factory to Handle pattern in May 2026. See [Handle Pattern Migration](../../../../project-intelligence/newapp/guides/handle-pattern-migration.md) for the full migration guide, before/after examples, and the `makeHandle<P>` test helper pattern.

## State Management

**Derive computed values in render**, don't store them:

```tsx
// ✅ Derive in render
function TodoList(handle: Handle) {
  let todos: string[] = []
  return () => {
    let completedCount = todos.filter(t => t.completed).length  // derived
    return <div>Completed: {completedCount}</div>
  }
}
```

**Don't store input state you only need on submit** — read from form data directly:

```tsx
function SearchForm(handle: Handle) {
  return () => (
    <form mix={[on('submit', (e) => {
      e.preventDefault()
      let query = new FormData(e.currentTarget).get('query')
      // Use query directly
    })]}>
      <input name="query" />
    </form>
  )
}
```

## Component Scope for One-Time Init

The component phase runs once — use it for initialization:

```tsx
function CacheExample(handle: Handle<{ cacheSize: number }>) {
  let cache = new Map<string, any>()  // one-time init
  let maxSize = handle.props.cacheSize

  return () => {
    if (cache.has(handle.props.key)) return <div>Cached</div>
    // ...
  }
}
```

## EventEmitter + TypedEventTarget

```tsx
import { TypedEventTarget, addEventListeners } from 'remix/ui'

class DataEmitter extends TypedEventTarget<{ data: DataEvent }> {}

function EventListener(handle: Handle<{ emitter: DataEmitter }>) {
  addEventListeners(handle.props.emitter, handle.signal, {
    data(event) { handle.update() },
  })
  return () => <div>Listening...</div>
}
```

## Key Points

- Do work in event handlers, minimize component state
- Use `handle.signal` for automatic cleanup (addEventListeners auto-cleans)
- Component phase for: cache init, SDK setup, event listener setup
- Derive computed values in render phase (not stored state)
- Read form data via `FormData` on submit, not stored input state

## Reference

Full source: `~/remix/packages/ui/docs/patterns.md`
