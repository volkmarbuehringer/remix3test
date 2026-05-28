# Guide: Creating Mixins

**Core Idea**: Model the runtime contract first, write smallest code matching it.

## Core Semantics

1. **Mixin handle** tied to one mounted host node lifecycle
2. **`insert`** - host-node availability point for imperative setup
3. **`remove`** - teardown for same lifecycle
4. **`queueTask`** - post-commit work receiving `(node, signal)`
5. **Render functions** should stay pure; side effects in `insert`/`remove`

## Pattern: Lifecycle-Managed Setup

```tsx
let withFocus = createMixin<HTMLElement>((handle) => {
  handle.addEventListener('insert', (event) => {
    event.node.focus()
  })
  return (props) => <handle.element {...props} />
})
```

## Pattern: Post-Commit DOM Work

```tsx
handle.queueTask((node) => {
  node.removeEventListener(prevType, stableHandler, prevCapture)
  node.addEventListener(nextType, stableHandler, nextCapture)
})
```

## Pattern: Pure Prop Transform

```tsx
let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
  <handle.element {...props} title={title} />
))
```

## Authoring Rules

1. Use `insert` for attach/setup, `remove` for cleanup
2. Keep state minimal and intentional
3. Use `queueTask` only when post-commit timing required
4. Use `invariant(...)` for guaranteed runtime conditions
5. Only `node` needed in most mixins; reach for `signal` only for async work
6. Do NOT add `signal.aborted` checks for synchronous work

## Checklist

- [ ] Runtime assumptions match reconciler behavior
- [ ] Lifecycle wiring uses `insert` and `remove` directly
- [ ] State is minimal
- [ ] `queueTask` only used when timing requires it
- [ ] Type flow from `createMixin<ThisType>` preserved

**Reference**: [create-mixins.md](./create-mixins.md)