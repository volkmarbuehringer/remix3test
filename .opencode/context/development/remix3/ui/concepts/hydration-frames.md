# Concept: Hydration & Frames

**Core Idea**: Use `clientEntry()` to mark interactive islands and `run()` to hydrate. Use `<Frame>` for server-rendered regions that load independently.

**Key Points**:
- `clientEntry(url, component)` marks interactive islands
- `run({ loadModule, resolveFrame })` hydrates the app
- `app.ready()` waits for initial hydration
- `<Frame>` enables independent loading of server-rendered regions
- `frameSrc` seeds SSR frame state

**Quick Example**:
```tsx
import { clientEntry, run } from 'remix/ui'

export let Counter = clientEntry('/assets/entry.js#Counter', (handle) => {
  let count = 0
  return () => <button onClick={() => { count++; handle.update() }}>{count}</button>
})

let app = run({
  async loadModule(url, exportName) {
    let mod = await import(url)
    return mod[exportName]
  },
  async resolveFrame(src, signal) {
    let headers = new Headers({ accept: 'text/html' })
    let response = await fetch(src, { headers, signal })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    return response.body ?? await response.text()
  },
})

await app.ready()
```

**Reference**: [packages/component/docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)

**Related**: `concepts/component-model.md`, `lookup/navigation.md`