<!-- Context: development/remix3/guides | Priority: medium | Version: 1.0 | Updated: 2026-04-25 -->

# Hydration

Make server-rendered components interactive on the client.

## Core Idea

`run()` boots the client runtime, `clientEntry()` exports components for client hydration. Server-rendered HTML becomes interactive without re-rendering.

## Key Points

- `run({ loadModule, resolveFrame })` - Boot client runtime with module loader
- `clientEntry('/path.js#Export', component)` - Export component for client hydration
- Hydration preserves server-rendered DOM; only client entries become interactive
- Frame content is resolved via `resolveFrame` during hydration
- Pending frames (non-blocking) continue streaming after hydration

## Quick Example

```tsx
// entry.tsx - Client entry
import { run } from 'remix/ui'

let app = run({
  loadModule: async (url, name) => (await import(url))[name],
  resolveFrame: async (src, signal) => {
    let res = await fetch(src, { signal })
    return res.body ?? res.text()
  },
})

await app.ready()
```

## Reference

`/home/lucky/remix/packages/component/docs/hydration.md`