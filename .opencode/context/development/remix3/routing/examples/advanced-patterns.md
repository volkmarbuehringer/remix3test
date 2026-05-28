# Example: Advanced Patterns

**Core Idea**: Refs, Context API, global events, async updates, fragments.

**Key Points**:
- `ref((node) => { ... })` captures DOM node, returns cleanup via signal
- Context API: `handle.context.set(value)`, `handle.context.get(Provider)` — **clientEntry only**
- `addEventListeners(target, handle.signal, handlers)` for globals
- Fragments: `<>...</>` for sibling elements

**Ref + Cleanup**:
```tsx
function ResizeComponent(handle: Handle) {
  let dimensions = { width: 0, height: 0 }

  return () => (
    <div
      mix={[
        ref((node, signal) => {
          let observer = new ResizeObserver((entries) => {
            let entry = entries[0]
            if (entry) {
              dimensions.width = Math.round(entry.contentRect.width)
              handle.update()
            }
          })
          observer.observe(node)
          signal.addEventListener('abort', () => observer.disconnect())
        }),
      ]}
    >
      Resize: {dimensions.width}×{dimensions.height}
    </div>
  )
}
```

**Context API**:
```tsx
function ThemeProvider(handle: Handle<{ theme: string }>) {
  handle.context.set({ theme: 'dark' })

  return () => <ThemedHeader />
}

function ThemedHeader(handle: Handle) {
  let { theme } = handle.context.get(ThemeProvider)
  return () => <header>Theme: {theme}</header>
}
```

**Global Events**:
```tsx
function KeyboardTracker(handle: Handle) {
  let keys: string[] = []

  addEventListeners(document, handle.signal, {
    keydown: (event) => {
      keys.push(event.key)
      if (keys.length > 10) keys.shift()
      handle.update()
    },
  })

  return () => <div>Keys: {keys.join(', ')}</div>
}
```

**Async Update + Queue Task**:
```tsx
async function toggleWithFocus(handle: Handle, button: HTMLButtonElement) {
  isPlaying = true
  await handle.update()
  button.focus()
}

handle.queueTask(() => button.scrollIntoView())
```

**Fragments**:
