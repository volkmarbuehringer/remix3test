# Example: Context API

**Purpose**: Share state across component trees.

> **⚠️ SSR LIMITATION**: `handle.context.set()` / `handle.context.get()` only work inside `clientEntry` components. Server-rendered components (simple factory functions returned from route handlers) cannot use context because they don't receive a `handle`. See `../errors/context-api-ssr-limitation.md`.

## Basic Context

```tsx
// Provider sets context value
function ThemeProvider(handle: Handle<{}, { theme: string }>) {
  handle.context.set({ theme: 'dark' })
  return () => <ThemedHeader />
}

// Consumer reads context
function ThemedHeader(handle: Handle) {
  let { theme } = handle.context.get(ThemeProvider)
  return () => (
    <header style={{ background: theme === 'dark' ? '#000' : '#fff' }}>
      Header
    </header>
  )
}

// Usage: nest inside ThemeProvider
<ThemeProvider>
  <ThemedHeader />
</ThemeProvider>
```

## Context with EventTarget

```tsx
class Theme extends TypedEventTarget<{ change: Event }> {
  #value: 'light' | 'dark' = 'light'
  get value() { return this.#value }
  setValue(v: 'light' | 'dark') {
    this.#value = v
    this.dispatchEvent(new Event('change'))
  }
}

function ThemeProvider(handle: Handle<{}, Theme>) {
  let theme = new Theme()
  handle.context.set(theme)
  return () => <ThemedContent />
}

function ThemedContent(handle: Handle) {
  let theme = handle.context.get(ThemeProviderAdvanced)
  addEventListeners(theme, handle.signal, {
    change() { handle.update() },
  })
  return () => <div>Theme: {theme.value}</div>
}
```

## Key Points

- `handle.context.set(value)` - Set context from provider
- `handle.context.get(ProviderComponent)` - Get context in consumer
- Context persists across updates (not re-set on every render)
- EventTarget enables reactive context changes

**Reference**: https://remix.run/docs/component/context

**Related**:
- concepts/component-model.md - Component model
- examples/handle-api.md - handle methods