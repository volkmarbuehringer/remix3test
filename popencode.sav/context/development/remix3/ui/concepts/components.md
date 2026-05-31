<!-- Context: development/remix3/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# Components

Components follow a two-phase structure: setup runs once, render runs on every update.

## Core Idea

The component function receives `Handle<Props>` as its first argument, with optional setup params after. It returns a render function that produces JSX. State lives in the setup closure and persists across renders. Props are accessed via `handle.props`.

## Key Points

- **Setup phase**: Runs once on mount, receives `handle` with typed props
- **Render phase**: Runs on initial render and every update, receives no arguments
- Props are accessed via `handle.props` — values refresh before each render
- Call `handle.update()` to trigger re-renders
- Event listeners via `addEventListeners()` auto-cleanup on unmount

## Quick Example

```tsx
import type { Handle } from 'remix/ui'

function Counter(handle: Handle<{ label: string }>, initialCount: number = 0) {
  let count = initialCount // Setup: run once

  return () => ( // Render: run on every update
    <div>
      {handle.props.label}: {count}
      <button onClick={() => { count++; handle.update() }}>+</button>
    </div>
  )
}
```

## Reference

`/home/lucky/remix/packages/component/docs/components.md`