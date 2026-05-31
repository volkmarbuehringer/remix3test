<!-- Context: development/remix3/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-07 -->

# Concept: Client Component Anatomy

**Purpose**: Understanding the two-phase lifecycle of `clientEntry` components - setup phase (runs once) and render phase (runs on every update), including setup params, render props, and accessibility patterns.

## Core Concept

`clientEntry` components use a closure pattern with two distinct phases. The outer function (setup) runs once during hydration to initialize state. The inner function (render) runs on every update to produce the UI.

## Two-Phase Pattern

```tsx
import { clientEntry, Handle, on } from 'remix/ui'

export const Counter = clientEntry(moduleUrl, (handle: Handle<CounterProps>, initialCount: number = 0) => {
  // Setup phase - runs ONCE
  let count = initialCount
  
  // Return render function - runs on every update
  return () => (
    <button mix={on('click', () => {
      count++
      handle.update() // Triggers re-render
    })}>
      Count: {count}
    </button>
  )
})
```

## Setup Params (2nd Function Parameter)

The second parameter receives values passed from the server at hydration time:

| Usage | Server Code | Description |
|-------|-------------|-------------|
| Primitive values | `<Counter initialCount={10} />` | Numbers, strings, booleans |
| Default values | `(handle, initialCount = 0)` | Optional with fallback |
| Complex objects | `<Counter config={obj} />` | Objects work via closure |

```tsx
// From server - app/controllers/fragments/controller.tsx
export default {
  actions: {
    counter() {
      let context = getContext()
      let url = new URL(context.request.url)
      let initialCount = parseInt(url.searchParams.get('initialCount') ?? '0', 10)
      return renderFragment(<Counter initialCount={initialCount} />)
    },
  },
}
```

## Render Props (via handle.props)

Dynamic props are accessed via `handle.props` in the render function:

```tsx
interface CounterProps {
  title?: string
  incrementLabel?: string
  decrementLabel?: string
}

export const Counter = clientEntry(moduleUrl, (handle: Handle<CounterProps>, initialCount: number = 0) => {
  let count = initialCount

  // Props passed at render time, not setup time
  return () => (
    <div>
      <h1>{handle.props?.title ?? 'Counter'}</h1>
      <button>{handle.props?.incrementLabel ?? 'Increment'}</button>
    </div>
  )
})
```

## Phase Comparison

| Aspect | Setup Phase | Render Phase |
|--------|-------------|--------------|
| Runs | Once on hydration | Every `handle.update()` |
| Parameters | `handle`, setup props from server | None (props via `handle.props`) |
| Purpose | Initialize state, setup | Produce JSX output |
| Variables | Persist via closure | Access closure variables |
| Side Effects | Setup event listeners | None (pure render) |

## Codebase References

**Implementation**:
- `bookstore/app/assets/counter.tsx` - Full example with setup params + render props
- `bookstore/app/controllers/test.tsx` - Frame embedding example

**Related**:
- `guides/client-state-management.md` - State management patterns
- `guides/client-entry-routes.md` - Full-page clientEntry routes (NEW)
- `examples/counter-pattern.md` - Complete counter example
