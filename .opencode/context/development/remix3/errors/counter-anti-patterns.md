<!-- Context: development/remix3/errors | Priority: medium | Version: 1.0 | Updated: 2026-04-07 -->

# Error: Counter Anti-Patterns

**Purpose**: Common mistakes when implementing client-side counters and interactive components in Remix 3.

## Anti-Pattern 1: Using const for State

```tsx
// ❌ WRONG: const prevents updates
export const Counter = clientEntry(moduleUrl, (handle: Handle) => {
  const count = 0  // Never changes!
  
  return () => (
    <button mix={on('click', () => {
      count++  // Error: Assignment to constant
      handle.update()
    })}>
      {count}
    </button>
  )
})
```

**Fix**: Use `let` for mutable state variables.

## Anti-Pattern 2: Forgetting handle.update()

```tsx
// ❌ WRONG: State changes but UI doesn't update
export const Counter = clientEntry(moduleUrl, (handle: Handle) => {
  let count = 0
  
  return () => (
    <button mix={on('click', () => {
      count++  // State changes...
      // Missing handle.update() - UI stays the same!
    })}>
      {count}
    </button>
  )
})
```

**Fix**: Always call `handle.update()` after state changes.

## Anti-Pattern 3: Using React Hooks

```tsx
// ❌ WRONG: React hooks don't exist in Remix components
import { useState } from 'react'  // Don't import!

export const Counter = clientEntry(moduleUrl, (handle: Handle) => {
  const [count, setCount] = useState(0)  // Won't work!
  // ...
})
```

**Fix**: Use plain variables and `handle.update()` instead.

## Anti-Pattern 4: Direct clientEntry in Server JSX

```tsx
// ❌ WRONG: Causes hydration errors
import { Counter } from '../assets/counter.tsx'

function Page() {
  return () => (
    <Layout>
      <Counter />  // DOMException: Node.insertBefore
    </Layout>
  )
}
```

**Fix**: Use `<Frame src={...}>` to embed client components.

## Quick Fixes

| Problem | Cause | Solution |
|---------|-------|----------|
| Count doesn't update | Using `const` | Change to `let` |
| UI doesn't refresh | Missing `handle.update()` | Add after state changes |
| Hook errors | Importing React | Remove hooks, use plain JS |
| Hydration errors | Direct JSX usage | Use `<Frame>` wrapper |

## Codebase References

**Working Implementation**:
- `bookstore/app/assets/counter.tsx` - Correct counter pattern
- `bookstore/app/controllers/test.tsx` - Proper Frame usage

**Related**:
- `concepts/client-component-anatomy.md` - Correct patterns
- `guides/client-state-management.md` - State management
- `guides/client-side-components.md` - Frame usage
