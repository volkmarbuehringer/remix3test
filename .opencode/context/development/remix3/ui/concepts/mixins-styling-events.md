# Concept: Mixins, Styling & Events

**Core Idea**: Compose behavior on host elements using `mix` array with built-in mixins from `remix/ui`.

## Key Points

- **mix**: array of mixins - prefer over legacy host props
- **Events**: `on(type, handler)` for DOM listeners, use `signal` for async work
- **Refs**: `ref((node) => ...)` for DOM node access
- **Styling**: `css(...)` for static stylesheet rules, `style` for dynamic values
- **Built-ins**: use provided mixins before custom code
  - `on(...)`, `ref(...)`, `css(...)`, `link(...)`
  - `pressEvents()`, `keysEvents()`
  - `animateEntrance()`, `animateExit()`, `animateLayout()`

## Quick Examples

### Events

```tsx
<form mix={[on('submit', async (event, signal) => {
  event.preventDefault()
  let formData = new FormData(event.currentTarget)
  await submit(formData, { signal })
})]} />
```

### Styling

```tsx
<button
  mix={[css({
    color: 'white',
    backgroundColor: 'blue',
    '&:hover': { backgroundColor: 'darkblue' },
  })]}
  style={{ opacity: disabled ? 0.5 : 1 }}
/>
```

### Refs

```tsx
<input mix={[ref((node) => node.focus())]} />
```

## Rules

- Event handlers receive `signal` - pass to async work when possible
- Check `signal.aborted` after async work if API can't cancel
- Use `css()` for selectors, nested rules, media queries
- Use `style` for dynamic values that change often
- Use `theme.*` tokens inside `css()` — not raw `var()` strings. `css()` automatically compiles `theme.*` to `var(--rmx-*)` references, ensuring dark mode works. Raw `var()` names won't match the generated `--rmx-*` variables from `createTheme()`.

### Valid `var()` Patterns

Two patterns where `var()` in `css()` is safe:

**1. Bridge pattern (all added 2026-05-06)**: Define local CSS variables sourced from `theme.*` at the top via `css()`, then reference them via `var()` throughout:
```tsx
const pageStyles = css({
  '--bg-primary': theme.surface.lvl0,
  '--border-color': theme.colors.border.default,
})
const cardStyle = css({
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
})
```
Works because variable values come from `theme.*`. More verbose but reduces repetition in long files.

**2. Inline style for dynamic `var()`**: Use `style={{ '--custom-var': dynamicValue }}` with `var(--custom-var)` in `css()` — valid for dynamic per-instance values (e.g., toast colors by type). The variable is always defined via the `style` prop, so no fallback is needed.
```tsx
<div mix={[css({ background: 'var(--toast-bg)' })]}
     style={{ '--toast-bg': isError ? '#dc2626' : '#16a34a' }} />
```

**Reference**: [mixins guide](./mixins-styling-events.md)