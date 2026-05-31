# Example: Counter & State Patterns

**Core Idea**: Two-phase component model with explicit state updates.

**Key Points**:
- Setup phase runs once, render function runs every update
- State is plain JS variable, call `handle.update()` to re-render
- Setup params (e.g., `setup` prop) vs runtime props
- `handle.id` provides unique DOM ID for labels/aria

**Quick Example**:
```tsx
import { on } from 'remix/ui'
import type { Handle } from 'remix/ui'

function Counter(handle: Handle<{ label?: string }>, initialCount = 0) {
  let count = initialCount // setup: runs once

  return () => (
    <div>
      <span>{handle.props.label || 'Count'}: {count}</span>
      <button
        mix={[
          on('click', () => {
            count++
            handle.update()
          }),
        ]}
      >
        Increment
      </button>
    </div>
  )
}
```

**Related**:
- concepts/component-model.md
- guides/css-mixins.md

**Reference**: [remix-run/component docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)