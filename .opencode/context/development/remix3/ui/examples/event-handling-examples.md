# Example: Event Handling

**Core Idea**: Event mixins via `on(...)`, controlled inputs, AbortSignal for async.

**Key Points**:
- `mix={[on('event', handler)]}` attaches event handlers
- `event.currentTarget` gives current element value
- `signal.aborted` checks if component still mounted
- Use `handle.update()` after state changes
- `handle.queueTask()` for post-render work (scroll, focus)

**Quick Example**:
```tsx
function SearchInput(handle: Handle) {
  let query = ''
  let loading = false

  return () => (
    <input
      type="text"
      value={query}
      mix={[
        on('input', (event, signal) => {
          query = event.currentTarget.value
          loading = true
          handle.update()

          setTimeout(() => {
            if (signal.aborted) return
            // ... async work
            loading = false
            handle.update()
          }, 300)
        }),
      ]}
    />
  )
}
```

**Controlled Input Example**:
```tsx
function SlugForm(handle: Handle) {
  let slug = ''
  let generatedSlug = ''

  return () => (
    <input
      type="text"
      value={generatedSlug || slug}
      disabled={!!generatedSlug}
      mix={[on('input', (e) => { slug = e.currentTarget.value; handle.update() })]}
    />
  )
}
```

**Reference**: [remix-run/component docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)