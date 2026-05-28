<!-- Context: development/remix3/guides/render-utilities | Priority: high | Version: 3.0 | Updated: 2026-05-03 -->

# Guide: Render Utilities

**Core Idea**: SSR render patterns for full pages, fragments, and Frame resolution using `new Response` with explicit `Content-Type` header.

## Core Pattern

```typescript
import { renderToStream } from 'remix/ui/server'
import { getContext } from 'remix/async-context-middleware'
import { assetServer } from './controller.tsx' // or './asset-server.ts' (bookstore pattern)
export function render(node, init?: ResponseInit) {
  let context = getContext()
  let request = context.request
  let router = context.router

  let stream = renderToStream(node, {
    frameSrc: request.url,
    async resolveFrame(src, target) {
      let headers = new Headers({ accept: 'text/html' })
      let cookie = request.headers.get('cookie')
      if (cookie) headers.set('cookie', cookie)
      if (target) headers.set('x-remix-target', target)

      let response = await router.fetch(new Request(new URL(src, request.url), { headers }))
      if (!response.ok) {
        return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
      }
      return response.body ?? response.text()
    },
    async resolveClientEntry(entryId, component) {
      // Dual-format: file:// URLs resolved via asset server, /assets/ paths used directly
      let exportName = component.name || entryId.split('#')[1] || 'default'

      if (entryId.startsWith('file://')) {
        return { href: await assetServer.getHref(entryId), exportName }
      }

      // Path-based IDs like '/assets/app/ui/prompt-button.tsx#PromptButton'
      let [href] = entryId.split('#')
      return { href, exportName }
    },
    onError(error) { console.error(error) },
  })

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(stream, { ...init, headers })
}
```

## renderFragment — Delegates to render()

```typescript
export function renderFragment(node, init?: ResponseInit) {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }
  return render(node, { ...init, headers })
}
```

Fragment responses add `Cache-Control: no-store` and delegate to `render()`. The framework's `resolveFrameHtml()` uses `stripDoctypeMarkup()` internally, so DOCTYPE wrappers from `new Response` do not corrupt frame data.

## Key Patterns

| Concern | Pattern |
|---------|---------|
| **HTML response** | `new Response(stream, { ...init, headers })` with explicit `Content-Type: text/html; charset=UTF-8` |
| **resolveFrame** | `resolveFrame(src, target)` — `target` sets `x-remix-target` header for targeted frame resolution |
| **Frame errors** | Return `<pre>Frame error: ${status} ${statusText}</pre>` — provides visible error in frame slot |
| **resolveClientEntry** | Dual-format: `file://` IDs → `assetServer.getHref()`, `/assets/` paths → split on `#` and use directly |
| **Streaming** | `response.body ?? response.text()` — returns ReadableStream when available |
| **Fragment caching** | `renderFragment` adds `Cache-Control: no-store`, delegates to `render()` |
| **Asset server import** | `import { assetServer } from './controller.tsx'` (inline, my_app) **or** `import { assetServer } from './asset-server.ts'` (separate module, bookstore) |

## Evolution

- **v1** (old): Manual `new Response(stream, { headers: { 'Content-Type': 'text/html' } })` + ReadableStream doctype prepending
- **v2** (current at time): `createHtmlResponse` handles Content-Type and doctype automatically
- **v3** (current now): `new Response(stream, { ...init, headers })` with explicit `Content-Type` — removes `createHtmlResponse` dependency, enables custom header merging via `new Headers(init?.headers)`

## Related

- `guides/frame-resolution.md` — ResolveFrame in depth
- `concepts/server-rendering.md` — Server rendering overview
- `errors/frame-rmx-data-parse.md` — Frame data parsing errors
- `errors/frame-programmatic-navigation.md` — Frame navigation issues

## Codebase References

- `my_app/app/actions/render.tsx` — `resolveFrame(src, target)`, `new Response`, `renderFragment`
- `bookstore/app/actions/render.tsx` — Same pattern, `accept-encoding: identity` for frame resolution
- `my_app/app/actions/controller.tsx` — `assetServer` exported and used by render.tsx
- `bookstore/app/actions/asset-server.ts` — Shared asset server module (avoids circular import)