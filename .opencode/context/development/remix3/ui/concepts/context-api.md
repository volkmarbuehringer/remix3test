<!-- Context: development/remix3/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-05 -->

# Context API

Ancestor/descendant communication without prop drilling, with optional granular updates.

> **⚠️ SSR LIMITATION**: `handle.context.set()` / `handle.context.get()` only works within `clientEntry` components (browser-side). Server-rendered components (simple factory functions) **cannot** use this API because they don't receive a `handle`. The `component()` function that would provide handle to non-clientEntry components does NOT exist. See `../errors/context-api-ssr-limitation.md`.

## Core Idea

Use `handle.context.set()` to provide values and `handle.context.get(Component)` to consume them inside `clientEntry` components. For granular updates, use `TypedEventTarget` to subscribe to specific changes.

## Key Points

- `handle.context.set(value)` stores context value (no auto-update)
- `handle.context.get(ProviderComponent)` retrieves ancestor's value (keyed by component identity)
- Call `handle.update()` after `context.set()` if tree needs to update
- `TypedEventTarget` enables granular updates (only subscribed components re-render)
- Use `addEventListeners()` to subscribe to context events
- **Only works in `clientEntry` components** — server-rendered components have no `handle`
- **Component identity**: Context lookup uses the exact component function reference. Nested instances of the same provider shadow outer ones. Different component types remain independent even with same-shaped values.
- **Shared provider scope**: Multiple components providing the same context should render a shared provider component so consumers use a single `get()` call

## Quick Example

```tsx
// clientEntry required for context API
export let ThemeProvider = clientEntry('/theme.js#ThemeProvider', function(handle: Handle<{ children: any }>) {
  let theme = new Theme()
  handle.context.set(theme)

  return () => handle.props.children
})

export let ThemedContent = clientEntry('/theme.js#ThemedContent', function(handle: Handle<void>) {
  let theme = handle.context.get(ThemeProvider)
  addEventListeners(theme, handle.signal, {
    change() { handle.update() },
  })

  return () => <div style={{ background: theme.value }} />
})
```

## Reference

`/home/lucky/remix/packages/component/docs/context.md`

**Related**:
- `../errors/context-api-ssr-limitation.md` — SSR limitation details
- `../examples/context-api.md` — More context examples