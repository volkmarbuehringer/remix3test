---
name: remix-render-middleware
description: Wire request-scoped renderers into your Remix router with `remix/middleware/render`. Activate when adding a typed `context.render(...)` to actions, or when building a custom response renderer for Remix UI, JSON, or other formats.
---

# Remix Render Middleware

Covers `remix/middleware/render`.

## Basic Usage

```ts
import { renderWith } from 'remix/middleware/render'

const render = renderWith(
  (context) =>
    function render(value: string, init?: ResponseInit) {
      return new Response(`${context.url.pathname}: ${value}`, init)
    },
)
```

Exposes `context.render(...)` and `context.get(Renderer)(...)`.

## Remix UI Renderer

```tsx
import { renderWith } from 'remix/middleware/render'
import { renderToStream } from 'remix/ui/server'
import { createHtmlResponse } from 'remix/response/html'

const render = renderWith(
  ({ router, url }) =>
    function render(node, init) {
      let stream = renderToStream(node, {
        async resolveFrame(src) {
          let response = await router.fetch(new URL(src, url))
          return response.ok
            ? (response.body ?? response.text())
            : `<pre>Frame error: ${response.status}</pre>`
        },
      })
      return createHtmlResponse(stream, init)
    },
)
```

## References

- `~/remix/packages/render-middleware/README.md` — full API with JSON and UI examples
- `~/remix/packages/response/README.md` — response helpers used inside renderers
- `~/remix/packages/ui/server/README.md` — server-side rendering
