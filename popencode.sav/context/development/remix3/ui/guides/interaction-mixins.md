<!-- Context: development/remix3/ui/guides | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Interaction Mixins

Build reusable event behavior with `createMixin()` that composes DOM events into semantic custom events. Use for complex gesture patterns reused across components.

## When to Create an Event Mixin

**Do**: Multiple low-level events → one semantic event, pattern reused across components, centralized timing/gesture state.
**Don't**: Native events are clear enough, behavior used once.

## Quick Example: Drag Release

```tsx
import { createMixin, on } from 'remix/ui'

export let dragReleaseType = 'myapp:drag-release' as const

export class DragReleaseEvent extends Event {
  constructor(public velocityX: number, public velocityY: number) {
    super(dragReleaseType, { bubbles: true, cancelable: true })
  }
}

export let dragRelease = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | undefined
  let tracking = false
  let velocityX = 0, velocityY = 0, lastX = 0, lastY = 0, lastT = 0

  handle.addEventListener('insert', (e) => { node = e.node })

  return () => (
    <handle.element mix={[
      on('pointerdown', (e) => {
        if (!e.isPrimary) return
        tracking = true; lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp
        velocityX = 0; velocityY = 0
        node?.setPointerCapture(e.pointerId)
      }),
      on('pointermove', (e) => {
        if (!tracking) return
        let dt = Math.max(1, e.timeStamp - lastT)
        velocityX = (e.clientX - lastX) / dt
        velocityY = (e.clientY - lastY) / dt
        lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp
      }),
      on('pointerup', () => {
        if (!tracking) return
        tracking = false
        node?.dispatchEvent(new DragReleaseEvent(velocityX, velocityY))
      }),
    ]} />
  )
})
```

## Key Points

- `createMixin<T>(factory)` — factory receives `handle`, returns render function
- `handle.addEventListener('insert'/'remove')` — lifecycle hooks for DOM attachment
- Dispatch custom events from node for consumer to handle via `on()`
- `handle.element` in JSX renders the host element with applied mixins
- Use `as const` for event type strings + global `HTMLElementEventMap` augmentation for TypeScript

## Reference

Full source: `~/remix/packages/ui/docs/interactions.md`
