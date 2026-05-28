# Guide: Testing Patterns

**Core Idea**: Use `createRoot()` and `root.flush()` for component unit tests.

## Quick Example

```tsx
import { createRoot } from 'remix/ui'

let container = document.createElement('div')
let root = createRoot(container)

root.render(<Counter />)
root.flush()

container.querySelector('button')?.click()
root.flush()

expect(container.textContent).toContain('1')
```

## Flush Rules

- **Flush after initial render** - listeners and queued tasks attached
- **Flush after interactions** - when component calls `handle.update()`
- **Flush after async work** - if component uses `queueTask(...)`
- Use `root.dispose()` to verify cleanup behavior

## High-Value Patterns

- Minimal component state
- Work in event handlers first
- Use `queueTask` for post-render work
- Use `TypedEventTarget` for granular context or events
- Prefer browser/CSS state over JS for hover/focus when possible

## Avoid

- Testing implementation-only markers unless only stable synchronization point
- Over-mocking framework behavior exercisable with real DOM
- Repeating same navigation assertion across many paths

**Reference**: [testing-patterns.md](./testing-patterns.md)