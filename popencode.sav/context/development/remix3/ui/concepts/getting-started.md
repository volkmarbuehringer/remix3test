<!-- Context: development/remix3/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# Getting Started

Two-phase component model: setup runs once on mount, render runs on every update.

## Core Idea

Remix Component uses a closure-based approach where the setup function captures initial state and the returned render function handles updates.

## Key Points

- `createRoot(container)` creates a root attached to a DOM element
- `root.render(<Component />)` renders the component tree
- `root.flush()` synchronously flushes pending updates
- `root.dispose()` removes the tree and cleans up
- Components follow: `function MyComponent(handle, setup) { return (props) => JSX }`

## Quick Example

```tsx
import { createRoot } from 'remix/ui'

function App(handle) {
  let count = 0
  return () => (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => { count++; handle.update() }}>+</button>
    </div>
  )
}

let root = createRoot(document.body)
root.render(<App />)
```

## Reference

`/home/lucky/remix/packages/component/docs/getting-started.md`