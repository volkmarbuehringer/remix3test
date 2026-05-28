<!-- Context: development/remix3/guides | Priority: medium | Version: 1.0 | Updated: 2026-04-25 -->

# Interactions

Handle user interactions with press events, keyboard navigation, and form handling.

## Core Idea

Prefer `press` events for cross-device support. Use `handle.update()` to trigger re-renders after state changes.

## Key Points

- `press` events fire on mouse, touch, and keyboard (Enter/Space) uniformly
- `click` is only for detecting right-clicks or modifier keys
- Form validation: `on('blur')` validates, `on('input')` clears validation
- Keyboard navigation: handle `ArrowUp`/`ArrowDown` with `preventDefault`
- Event handlers should do work directly; only store what renders need

## Quick Example

```tsx
function Form() {
  return () => (
    <form onSubmit={(e) => {
      e.preventDefault()
      let data = new FormData(e.currentTarget)
    }}>
      <input onBlur={(e) => {
        if (!e.currentTarget.value.includes('@')) {
          e.currentTarget.setCustomValidity('Invalid')
        }
      }} onInput={(e) => e.currentTarget.setCustomValidity('')} />
      <button pressEvents onPress={() => handle.update()}>Submit</button>
    </form>
  )
}
```

## Reference

`/home/lucky/remix/packages/component/docs/interactions.md`