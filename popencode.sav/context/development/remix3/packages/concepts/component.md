<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.1 | Updated: 2026-05-05 -->

# Concept: Component

**Purpose**: Minimal component system built on JavaScript and DOM primitives. Server rendering, client hydration, and partial streaming via Frames.

> **Important**: The `remix/component` subpath is NOT defined in remix's package.json exports. The `component()` factory function does NOT exist. All components are plain factory functions that receive `handle` as the first parameter. Use `clientEntry()` from `remix/ui` to mark browser-interactive components.

**Key Points**:
- JSX runtime with setup/render phase pattern
- State managed with plain JavaScript variables
- Manual updates via `handle.update()`
- Real DOM events with `on()` mixin
- Inline CSS via `css()` mixin with pseudo-selectors
- Server streaming with `renderToStream`
- Client hydration with `clientEntry` and `run`
- Frames for partial server UI streaming

**Minimal Example**:
```tsx
import { renderToStream, clientEntry, on, run } from 'remix/ui'
import type { Handle } from 'remix/ui'

// Server: Render to streaming response
let stream = renderToStream(<App />)

// Client: Mark interactive components
export let Counter = clientEntry('/counter.js#Counter', function Counter(handle: Handle<{ label: string }>, setup) {
  let count = setup
  return () => (
    <button mix={[on('click', () => { count++; handle.update() })]}>
      {handle.props.label}: {count}
    </button>
  )
})

// Client: Boot hydration
run({ loadModule, resolveFrame })
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/component