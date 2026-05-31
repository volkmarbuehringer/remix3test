# Composition

**Core Idea**: Build component trees with props, children, `ref()` mixin for DOM access, and `key` prop for list diffing.

**Key Points**:
- Props flow parent→child via JSX attributes; `props.children` renders child content
- `ref((node, signal) => { ... })` mixin — called once when element renders; `signal` aborted on DOM removal
- Use `key` prop for list identity — enables DOM reuse, state preservation across reorders
- Keys can be string/number/bigint/object/symbol; must be stable and unique within the list
- `key` preserves input values, focus state, and component instances across re-renders

**Minimal Example**:
```tsx
import type { Handle } from 'remix/ui'

function Layout(handle: Handle<{ children: RemixNode }>) {
  return () => {
    let { children } = handle.props
    return (
      <main>{children}</main>
    )
  }
}

function List(handle: Handle<void>) {
  let items = [{ id: 'a', text: 'Item A' }]
  return () => <ul>{items.map(item => <li key={item.id}>{item.text}</li>)}</ul>
}
```

**Reference**: `~/remix/packages/ui/docs/composition.md`
