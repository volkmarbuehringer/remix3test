# Lookup: Host Elements

**Purpose**: Quick reference for host element mixins, events, styling, and built-in helpers.

**Mixins** (from `remix/ui`):
- `on(type, handler)` - DOM listeners
- `ref((node) => ...)` - DOM node access
- `css({...})` - Static stylesheet-like rules
- `link(href, options)` - Navigation link behavior
- `pressEvents()` - Pointer + keyboard input
- `keysEvents()` - Key-specific events
- `animateEntrance/exit/layout()` - Animations

**Events**:
```tsx
<form mix={[on('submit', async (event, signal) => {
  event.preventDefault()
  let formData = new FormData(event.currentTarget)
  await submit(formData, { signal })
})]} />
```

**Styling**:
- `css(...)` for selectors, nested rules, media queries
- `style` for dynamic values that change often

```tsx
<button
  mix={[css({ color: 'white', '&:hover': { backgroundColor: 'darkblue' } })]}
  style={{ opacity: disabled ? 0.5 : 1 }}
/>
```

**Reference**: [packages/component/docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)

**Related**: `guides/animation.md`, `guides/mixins.md`