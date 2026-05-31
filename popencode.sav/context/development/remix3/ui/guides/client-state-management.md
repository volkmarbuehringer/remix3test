<!-- Context: development/remix3/guides | Priority: high | Version: 1.0 | Updated: 2026-04-07 -->

# Guide: Client-Side State Management

**Purpose**: Best practices for managing state in `clientEntry` components using plain JavaScript variables and explicit updates.

## Core Principles

Unlike React's reactive system, Remix components use explicit state management:
- State = plain JavaScript variables (`let`, not `const`)
- Updates = explicit `handle.update()` calls
- No automatic re-rendering or dependency tracking

## State Patterns

### Basic Counter State

```tsx
export const Counter = clientEntry(moduleUrl, (handle: Handle) => {
  let count = 0  // Mutable state

  return () => (
    <button mix={on('click', () => {
      count++
      handle.update()  // Must trigger manually
    })}>
      Count: {count}
    </button>
  )
})
```

### Multiple State Variables

```tsx
export const Form = clientEntry(moduleUrl, (handle: Handle) => {
  let name = ''
  let email = ''
  let isSubmitting = false

  return () => (
    <form>
      <input 
        value={name}
        mix={on('input', (e) => {
          name = e.target.value
          handle.update()
        })}
      />
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
})
```

## Best Practices

1. **Always use `let`** for mutable state (never `const`)
2. **Call `handle.update()`** after every state change
3. **Batch multiple updates** - single `handle.update()` after all changes
4. **Keep setup phase pure** - no side effects in render function
5. **Use closures** for computed values instead of re-calculating in render

## Anti-Patterns to Avoid

- ❌ Using `const` for state (won't update)
- ❌ Forgetting to call `handle.update()` (UI won't refresh)
- ❌ Calling `handle.update()` in the setup phase
- ❌ Using React hooks (useState, useEffect, etc.)

## Codebase References

**Implementation**:
- `bookstore/app/assets/counter.tsx` - State management example

**Related**:
- `concepts/client-component-anatomy.md` - Two-phase pattern
- `examples/counter-pattern.md` - Working example
- `errors/counter-anti-patterns.md` - Common mistakes
