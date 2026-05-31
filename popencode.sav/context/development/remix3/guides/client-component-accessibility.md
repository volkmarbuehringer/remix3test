<!-- Context: development/remix3/guides | Priority: medium | Version: 1.0 | Updated: 2026-04-07 -->

# Guide: Accessibility in Client Components

**Purpose**: Patterns for making client-side components accessible using ARIA attributes and semantic HTML in Remix 3's non-React environment.

## Core Accessibility Principles

Client components in Remix 3 lack React's synthetic event system, so accessibility must be implemented using native HTML attributes:

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`)
- Add ARIA attributes for screen reader support
- Ensure keyboard navigation works without JavaScript
- Provide text alternatives for visual content

## Live Regions for Dynamic Content

When updating content dynamically (like counters, toasts, status updates), use `aria-live` to announce changes to screen readers:

```tsx
export const Counter = clientEntry(moduleUrl, (handle) => {
  let count = 0

  return () => (
    <div>
      <p aria-live="polite">
        Counter value: <span role="status">{count}</span>
      </p>
      <button mix={on('click', () => {
        count++
        handle.update()
      })}>
        Increment
      </button>
    </div>
  )
})
```

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `aria-live` | `"polite"` | Announces changes when user is idle |
| `aria-live` | `"assertive"` | Announces immediately (use sparingly) |
| `role` | `"status"` | Semantic status region for screen readers |

**Best Practice**: Use `aria-live="polite"` for most cases - it announces when the user stops interacting, avoiding interruption.

## Button Accessibility

Buttons must have accessible names. Use `aria-label` for icon buttons or to provide better context:

```tsx
<button
  type="button"
  class="btn"
  aria-label={props?.incrementLabel ?? 'Increment counter'}
  mix={on('click', () => {
    count++
    handle.update()
  })}
>
  {props?.incrementLabel ?? 'Increment'}
</button>

<button
  type="button"
  class="btn icon-only"
  aria-label="Open menu"  // Icon button needs text alternative
  mix={on('click', openMenu)}
>
  <MenuIcon />
</button>
```

## Form Accessibility

For form inputs in client components:

```tsx
<label for="email-input">Email</label>
<input
  type="email"
  id="email-input"
  name="email"
  required
  aria-describedby="email-hint"
/>
<span id="email-hint">We'll never share your email.</span>
```

## Skip Links and Focus Management

For single-page-like experiences with frames, ensure focus management:

```tsx
// After navigation within a frame, announce completion
<p aria-live="polite" aria-atomic="true">
  Showing results for "{query}"
</p>
```

## Codebase References

**Implementation**:
- `bookstore/app/assets/counter.tsx` - `aria-live`, `role="status"`, `aria-label` on buttons

**Related**:
- `examples/counter-pattern.md` - Complete counter with accessibility
- `guides/layout.md` - Skip links and focus management