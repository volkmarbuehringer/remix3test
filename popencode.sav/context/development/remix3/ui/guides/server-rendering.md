<!-- Context: development/remix3/ui/guides | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Server Rendering

Server rendering APIs for streaming Remix UI trees and frames.

## renderToStream

Renders a component tree into a `ReadableStream` for HTTP responses. Accepts callbacks for frame resolution and client entry resolution:

```tsx
import { renderToStream } from 'remix/ui/server'
import { Frame } from 'remix/ui'

let stream = renderToStream(<App />, {
  resolveFrame: (src) => fetchFrameHtml(src),
  resolveClientEntry: async (entryId, component) => ({
    href: await resolveEntryId(entryId),
    exportName: entryId.split('#')[1] || component.name,
  }),
})
return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})
```

## Frame Behavior

- **Blocking** (no `fallback` prop): Server waits for frame content before sending initial HTML chunk
- **Non-blocking** (with `fallback`): Fallback renders in initial chunk, real content streams in later

```tsx
<Frame src="/critical-header" />                    {/* blocking */}
<Frame src="/recommendations" fallback={<div>Loading...</div>} />  {/* non-blocking */}
```

## Client Entry Resolution

`renderToStream` accepts a `resolveClientEntry(entryId, component)` callback. The function receives an opaque entry ID and the component function, and returns `{ href, exportName }`. This decouples server rendering from module resolution strategy.

## Reference

Full source: `~/remix/packages/ui/src/server/`
Docs: `~/remix/packages/ui/docs/frames.md`, `~/remix/packages/ui/docs/hydration.md`
