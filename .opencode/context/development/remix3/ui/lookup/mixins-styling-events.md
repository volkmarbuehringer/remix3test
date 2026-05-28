<!-- Context: remix3/lookup/mixins-styling-events | Priority: high | Version: 1.0 | Updated: 2026-04-16 -->

# Lookup: Mixins, Styling & Events

**Core Concept**: Use `mix={[...]}` for host element behavior instead of legacy props. Prefer built-in helpers over custom code.

## Key Points

**Available mixins** (from `remix/ui`):
- `on(type, handler)` - DOM listeners
- `ref(node => ...)` - DOM node access
- `css({...})` - static stylesheet rules with selectors/media
- `link(href, options)` - non-anchor navigation
- `pressEvents()` - pointer + keyboard input
- `keysEvents()` - keyboard-specific events
- `animateEntrance()`, `animateExit()`, `animateLayout()` - animations

**Event rules**:
- Handlers receive `signal` - pass to async work
- Check `signal.aborted` after async work

**Styling**:
- `css(...)`: selectors, nested rules, media queries
- `style`: dynamic values (numbers/strings that change)

## Quick Examples

```tsx
// Event with signal
<form mix={[on('submit', async (e, signal) => {
  e.preventDefault()
  await submit(new FormData(e.currentTarget), { signal })
})]} />

// Ref
<input mix={[ref(n => n.focus())]} />

// CSS mixin
<button mix={[css({ color: 'white', '&:hover': { background: 'blue' } })]} />

// Dynamic style
<div style={{ opacity: loading ? 0.5 : 1 }} />
```

## Reference

Full docs: `~/remix/skills/remix-ui/references/mixins-styling-events.md`