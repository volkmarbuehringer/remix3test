<!-- Context: development/remix3/errors/mix-array-event-only | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# Error: mix Array Wrapper with Single Event Causes Re-render Loop

**Symptom**: Client entry component renders repeatedly in an infinite loop. The browser tab may freeze or show rapid DOM updates.

**Cause**: Using `mix={[on('click', handler)]}` — wrapping a single event mixin in an array — creates a new array reference on every render, which triggers the VDOM diff to detect a change and re-render, creating an infinite loop.

## The Problem

```tsx
// ❌ WRONG: Array with only event mixin — new array reference every render → infinite loop
<button mix={[on('click', handler)]}>Action</button>
```

The VDOM compares mix arrays by reference. Each render produces a new array literal `[...]`, so the VDOM always sees a "changed" mix array and schedules a re-render, which creates another new array, and so on.

## The Fix

When the mix array would contain only a single event mixin, omit the array wrapper entirely:

```tsx
// ✅ CORRECT: Single event mixin — no array wrapper, stable reference
<button mix={on('click', handler)}>Action</button>
```

## When Arrays Are Correct

Arrays are only needed when composing **multiple** mixins together:

```tsx
// ✅ CORRECT: Multiple mixins require array
<button mix={[on('click', handler), css({ padding: '0.5rem' })]}>Action</button>

// ❌ WRONG: Array with single event mixin
<button mix={[on('click', handler)]}>Action</button>
```

## Pattern: Check Your mix Usage

| Pattern | Status | Reason |
|---------|--------|--------|
| `mix={on('click', handler)}` | ✅ Correct | Stable reference, no array |
| `mix={[on('click', handler)]}` | ❌ Loop | New array ref each render |
| `mix={[on('click', handler), css({...})]}` | ✅ Correct | Multiple mixins need array |
| `mix={on('submit', handler)}` | ✅ Correct | Single event, no wrapper |

## Codebase Examples

Components from the bookstore demo and admin panels use the correct pattern:

```tsx
// From bookstore cart-button.tsx — correct: no array wrapper
<button mix={on('click', async (_event, signal) => { ... })}>
  {inCart ? 'Remove' : 'Add'}
</button>

// Counter pattern — correct: no array wrapper
<button mix={on('click', () => { count++; handle.update() })}>
  Decrement
</button>
```

## Differentiation from Related Loops

This error differs from `client-entry-loops.md` (handle.update() infinite loops caused by state-in-render or per-row clientEntry). The root cause here is purely VDOM diff behavior with array references:

- **This error**: Array wrapper `[on(...)]` → new array reference → VDOM sees change → re-render → loop
- **client-entry-loops.md**: State modification during render → handle.update() triggered → re-render → loop

## Related

- `errors/client-entry-loops.md` — Other types of client entry infinite loops
- `ui/guides/client-entry-routes.md` — Shows correct `mix={on('click', ...)}` pattern in examples
- `ui/concepts/mixins-styling-events.md` — Mixin composition rules
- `ui/examples/cart-button-pattern.md` — Working example with correct mix usage
- `ui/examples/counter-pattern.md` — Counter with correct single-event mix
