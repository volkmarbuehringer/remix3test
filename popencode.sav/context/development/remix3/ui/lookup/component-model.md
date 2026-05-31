<!-- Context: remix3/lookup/component-model | Priority: high | Version: 1.0 | Updated: 2026-04-16 -->

# Lookup: Remix Component Model

**Core Concept**: Two-phase component lifecycle (setup runs once, render runs on updates) with state in plain JS variables and explicit `handle.update()` calls.

## Key Points

- Setup: runs once per instance, return render function
- Render: runs on initial render and every update
- State: plain JS variables in setup scope, not React-style state
- `handle.update()`: schedules rerender, await for DOM sync
- `handle.queueTask()`: post-render DOM work, loading states, focus
- `handle.signal`: auto-aborted on component disconnect
- `handle.context`: ancestor/descendant communication
- `handle.frame`: frame-aware behavior for client entries

## Quick Example

```tsx
import { on } from 'remix/ui'
import type { Handle } from 'remix/ui'

function Counter(handle: Handle<{ label: string }>, initialCount = 0) {
  let count = initialCount

  return () => (
    <button mix={[on('click', () => {
      count++
      handle.update()
    })]}>
      {handle.props.label}: {count}
    </button>
  )
}
```

## Global Events

```tsx
addEventListeners(window, handle.signal, {
  resize() {
    width = window.innerWidth
    handle.update()
  },
})
```

## Reference

Full docs: `~/remix/skills/remix-ui/references/component-model.md`