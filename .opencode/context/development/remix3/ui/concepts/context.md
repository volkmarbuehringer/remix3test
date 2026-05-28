# Context

**Core Idea**: Components communicate without prop drilling via `handle.context.set()` and `handle.context.get()`, keyed by component identity.

**Key Points**:
- `handle.context.set({ theme: 'dark' })` — provides value to descendants (does NOT trigger updates)
- `handle.context.get(ProviderComponent)` — reads nearest ancestor's context, type-inferred from Handle
- Context lookup is keyed by component function identity — avoids collisions between providers
- For granular updates, use `TypedEventTarget` + `addEventListeners` to avoid full subtree re-renders
- Provider must call `handle.update()` if it renders context values itself

**Minimal Example**:
```tsx
function ThemeProvider(handle: Handle<{ children?: RemixNode }, { theme: string }>) {
  let theme = 'light'
  handle.context.set({ theme })
  return () => handle.props.children
}

function ThemedContent(handle: Handle) {
  let { theme } = handle.context.get(ThemeProvider)
  return () => <div>Theme: {theme}</div>
}
```

**Reference**: `~/remix/packages/ui/docs/context.md`
