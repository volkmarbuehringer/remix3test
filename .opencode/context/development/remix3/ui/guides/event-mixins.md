# Event Mixins

**Core Idea**: Build reusable event behavior with `createMixin` — compose native DOM events into semantic custom events.

**Key Points**:
- Create when combining multiple low-level events into one semantic gesture that's reused across components
- Use `createMixin<HTMLElement>((handle) => {...})` — returns a mixin function callable in `mix={[...]}`
- Listen for `insert`/`remove` events on the mixin handle for node lifecycle
- Dispatch typed custom events from mixins; namespace event names (`myapp:*`) to avoid collisions
- For simple cases, just use `on('click', ...)` and native events — mixins are for complex, reused behavior

**Minimal Example**:
```tsx
import { createMixin, on } from 'remix/ui'

export let dragRelease = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | undefined
  handle.addEventListener('insert', (event) => { node = event.node })
  return () => (<handle.element mix={[
    on('pointerdown', (e) => { node?.setPointerCapture(e.pointerId) }),
    on('pointerup', () => { node?.dispatchEvent(new CustomEvent('myapp:drag-release')) }),
  ]} />)
})
```

**Reference**: `~/remix/packages/ui/docs/interactions.md`
