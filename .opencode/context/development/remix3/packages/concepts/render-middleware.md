<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Render Middleware

**Purpose**: Request-scoped renderer middleware for Remix. Stores a render function in fetch-router request context so route actions can render responses without passing renderer details through every handler.

**Key Points**:
- `renderWith(factory)` — creates middleware; factory receives `RequestContext`, returns a render function
- Typed `context.render(...)` or `context.get(Renderer)`
- Generic — renders any value type to `Response` (HTML, JSON, UI nodes, etc.)
- Factory runs per-request, so renderers can access request-specific data (URL, auth, etc.)

**Minimal Example**:
```ts
import { createRouter, type MiddlewareContext } from 'remix/router'
import { renderWith } from 'remix/middleware/render'

const render = renderWith((context) =>
  function render(value: string, init?: ResponseInit) {
    return new Response(`${context.url.pathname}: ${value}`, init)
  },
)
```

**JSON Renderer**:
```ts
const json = renderWith(() =>
  function render(data: unknown, init?: ResponseInit) {
    return Response.json(data, init)
  },
)
```

**Remix UI Renderer**:
```ts
import { createHtmlResponse } from 'remix/response/html'
import { renderToStream } from 'remix/ui/server'
import type { RemixNode } from 'remix/ui'

const render = renderWith(({ router, url }) =>
  function render(node: RemixNode, init?: ResponseInit) {
    let stream = renderToStream(node, {
      async resolveFrame(src) {
        let response = await router.fetch(new URL(src, url))
        return response.ok ? (response.body ?? response.text()) : `<pre>Frame error: ${response.status}</pre>`
      },
    })
    return createHtmlResponse(stream, init)
  },
)
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/render-middleware
