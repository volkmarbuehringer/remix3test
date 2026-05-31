# Guide: Creating Mixins

**Core Idea**: Author reusable mixins with `createMixin()`. Key semantics: lifecycle tied to one mounted host node, `insert` is setup, `remove` is teardown.

**Key Points**:
- Mixin handle = one mounted host node lifecycle
- Use `insert` event for attach/setup, `remove` for cleanup
- Use `queueTask((node, signal) => ...)` only when post-commit timing required
- Keep state minimal and intentional
- Avoid state for hypothetical runtime scenarios

**Quick Example**:
```tsx
createMixin<HTMLElement>((handle) => {
  handle.addEventListener('insert', (event) => {
    event.node.focus()
  })

  handle.addEventListener('remove', () => {
    // Clean up listeners, timers, observers
  })

  return (props) => <handle.element {...props} />
})
```

**Authoring Rules**:
1. Start with lifecycle truth (insert/remove)
2. Use `queueTask` only when timing requires it
3. Use `invariant(...)` for guaranteed runtime conditions
4. Favor function expressions for helpers in scope

**Reference**: [packages/component/docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)

**Related**: `lookup/host-elements.md`, `guides/animation.md`