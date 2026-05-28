<!-- Context: development/remix3/examples | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# Styling

Inline CSS with `css()` mixin, supporting pseudo-selectors, nesting, and media queries.

## Core Idea

Use `css()` for static styles; use `style` prop for dynamic styles. CSS nesting uses `&` for parent reference.

## Key Points

- **Static styles**: Use `css()` mixin (inserted as CSS rules)
- **Dynamic styles**: Use `style` prop (inline, avoids creating new rules)
- **Pseudo-selectors**: `&:hover`, `&::before`, `&:focus`
- **Nesting**: Use for parent-state-affecting-children; avoid for element's own states
- **Media queries**: `@media` with responsive breakpoints
- **Attribute selectors**: `&[required]`, `&[aria-invalid="true"]`

## Quick Example

```tsx
function Button() {
  return () => (
    <button
      mix={[
        css({
          backgroundColor: 'blue',
          color: 'white',
          '&:hover': { backgroundColor: 'darkblue' },
          '@media (max-width: 768px)': { padding: '8px' },
        }),
      ]}
    />
  )
}

// Dynamic style - use style prop
function Progress(handle) {
  let progress = 0
  return () => (
    <div
      mix={[css({ backgroundColor: 'blue' })]}
      style={{ width: `${progress}%` }}
    />
  )
}
```

## Reference

`/home/lucky/remix/packages/component/docs/styling.md`