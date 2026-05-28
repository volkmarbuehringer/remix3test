# Hydration

**Core Idea**: Mark components with `clientEntry` to hydrate them on the client. Only marked components ship JavaScript — the rest stays static HTML.

**Key Points**:
- `clientEntry(moduleUrl, component)` — marks a component for client hydration; format: `moduleUrl#ExportName`
- Server renders `clientEntry` components normally, wraps output in `<!-- rmx:h:id -->` markers
- Props serialized to JSON in `<script type="application/json" id="rmx-data">`
- `run({ loadModule, resolveFrame })` — scans for markers, loads modules, hydrates in place
- `run` returns `{ ready(), flush(), dispose() }` — also an `EventTarget` for error events
- Supported serialized prop types: strings, numbers, booleans, `null`, plain objects/arrays, JSX elements, `<Frame>` elements

**Minimal Example**:
```tsx
// Component (server + client)
export let Counter = clientEntry('/assets/counter.js#Counter',
  function Counter(handle: Handle<{ initialCount?: number }>) { ... })

// Client boot
let app = run({ loadModule: (url, exp) => import(url).then(m => m[exp]) })
await app.ready()
```

**Reference**: `~/remix/packages/ui/docs/hydration.md`
