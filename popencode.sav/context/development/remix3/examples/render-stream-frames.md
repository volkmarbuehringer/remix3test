<!-- Context: development/remix3/examples/render-stream-frames | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Example: renderToStream with Frame Resolution

**Core Idea**: The template's `render.tsx` streams HTML with frame sub-requests and client entry resolution. Simpler than the `getContext` variant — passes `request` directly.

## render.tsx (Template Pattern)

```typescript
import * as path from 'node:path'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'
import { assetServer } from './controller.tsx'
import { router } from '../router.ts'

export function render(node: RemixNode, request: Request, init?: ResponseInit) {
  let stream = renderToStream(node, {
    frameSrc: request.url,
    async resolveClientEntry(entryId, component) {
      if (!entryId.startsWith('file://')) {
        throw new Error(`Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`)
      }
      return {
        href: await assetServer.getHref(entryId),
        exportName: entryId.split('#')[1] || component.name || titleCaseFileName(entryId),
      }
    },
    async resolveFrame(src, target) {
      let headers = new Headers({ accept: 'text/html' })
      let cookie = request.headers.get('cookie')
      if (cookie) headers.set('cookie', cookie)
      if (target) headers.set('x-remix-target', target)

      let response = await router.fetch(new Request(new URL(src, request.url), { headers }))
      return response.body ?? response.text()
    },
  })

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=utf-8')
  }
  return new Response(stream, { ...init, headers })
}
```

## Key Differences from getContext Variant

| Concern | Template (this) | getContext variant |
|---------|----------------|-------------------|
| **Request source** | Passed as parameter | `getContext().request` |
| **Router access** | Imported directly | `getContext().router` |
| **Requires asyncContext middleware** | No | Yes |
| **Frame error handling** | None (throws) | Returns `<pre>Frame error: ...</pre>` |

## Reference

- Template: `~/remix/template/app/actions/render.tsx`
- Full render utilities guide: `guides/render-utilities.md`
- Frame resolution guide: `guides/frame-resolution.md`
