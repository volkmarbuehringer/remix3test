# Getting Started

**Core Idea**: Create interactive UIs with Remix UI's two-phase component model — setup once, render on every update.

**Key Points**:
- **Client-only**: `createRoot(container).render(<App />)` — renders into a DOM element
- **Server-rendered**: `renderToStream(<App />, { resolveFrame })` → stream to HTML response
- **Client entries**: `clientEntry` marks hydrated components; `run()` boots the client
- Root methods: `render(node)`, `flush()`, `dispose()`
- `handle.update()` triggers re-render; `handle.queueTask()` schedules post-render work

**Minimal Example**:
```tsx
// Client-side
import { createRoot } from 'remix/ui'
function App(handle: Handle) {
  let count = 0
  return () => (<div><button mix={[on('click', () => { count++; handle.update() })]}>{count}</button></div>)
}
let root = createRoot(document.body)
root.render(<App />)
```

**Reference**: `~/remix/packages/ui/docs/getting-started.md`
