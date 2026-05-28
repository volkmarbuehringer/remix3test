<!-- Context: development/remix3/guides/frame-resolution | Priority: high | Version: 3.0 | Updated: 2026-05-03 -->

# Frame Resolution

Server-side frame resolution for nested routing in Remix 3.

## Pattern

```typescript
// app/actions/render.tsx
import { renderToStream } from 'remix/ui/server'
import { getContext } from 'remix/async-context-middleware'
import { assetServer } from './controller.tsx' // or './asset-server.ts' (no circular dep)

export function render(node: RemixNode, init?: ResponseInit) {
  let context = getContext()
  let request = context.request
  let router = context.router

  let stream = renderToStream(node, {
    frameSrc: request.url,
    async resolveFrame(src, target) {
      let url = new URL(src, request.url)

      let headers = new Headers({ accept: 'text/html' })
      headers.set('x-remix-frame', 'true')   // ← required for Frame detection
      let cookie = request.headers.get('cookie')
      if (cookie) headers.set('cookie', cookie)
      if (target) headers.set('x-remix-target', target)

      let res = await router.fetch(
        new Request(url, { method: 'GET', headers, signal: request.signal }),
      )
      if (!res.ok) {
        return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
      }
      return res.text()  // ← always string! ReadableStream breaks Frame SSR
    },
    ...
  })

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(stream, { ...init, headers })
}
```

## Client-Side Handler

```typescript
// app/assets/entry.tsx
import { run } from 'remix/ui'

let app = run({
  async loadModule(moduleUrl, name) {
    let mod = await import(moduleUrl)
    return mod[name]
  },
  async resolveFrame(src, signal, target) {
    let headers = new Headers({ accept: 'text/html' })
    headers.set('x-remix-frame', 'true')
    if (target) headers.set('x-remix-target', target)

    let url = new URL(src, window.location.href)
    let res = await fetch(url, { headers, signal, credentials: 'same-origin' })
    if (!res.ok) {
      return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
    }
    return res.text()  // ← always string for Frame SSR
  },
})
```

## Evolution

| Version | `resolveFrame` signature | Response type | Status |
|---------|--------------------------|---------------|--------|
| v1 | `resolveFrame(src)` | `new Response` manual | Replaced |
| v2 | `resolveFrame(src)` | `createHtmlResponse` | Replaced |
| v3 (current) | `resolveFrame(src, target)` | `new Response` with explicit `Content-Type` + `x-remix-target` forwarding | Current |

The `target` parameter was re-added in v3 — it forwards as the `x-remix-target` header, enabling targeted frame resolution. The `signal` from the original request is also forwarded for proper cancellation.

## Critical Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| `resolveFrame` returns `response.body` (ReadableStream) | Frame SSR renders empty markers — no content between `<!-- rmx:f:id -->` and `<!-- /rmx:f -->` | Always return `response.text()` (string). The Frame server streamer cannot pipe a ReadableStream into the inline template. |
| Missing `x-remix-frame: true` header | Server cannot distinguish Frame requests from full page loads | Set the header in BOTH server-side and client-side `resolveFrame` — follows the `frame-navigation` demo pattern |
| Programmatic Navigation API for Frame updates | `navigate(href, { target })` works unreliably; `<a rmx-target>` `.click()` doesn't set `sourceElement` in Chrome | For programmatic Frame updates, use `fetch()` + DOM replacement within the Frame's content area instead of the Navigation API |

See also: `errors/frame-programmatic-navigation.md` for full Navigation API limitations.

## Frame Error Handling

| Error Type | Response |
|------------|----------|
| Non-ok response (4xx, 5xx) | `<pre>Frame error: ${status} ${statusText}</pre>` |
| Network error / timeout | Caught by `onError` in `renderToStream` options |

The `<pre>` tag shows a visible error inside the frame slot without breaking parent page hydration.

## Related

- `guides/render-utilities.md` — Full render utility patterns
- `concepts/server-rendering.md` — Server rendering overview

## Codebase References

- `my_app/app/actions/render.tsx` — `resolveFrame(src, target)` with `x-remix-target` header
- `bookstore/app/actions/render.tsx` — Same pattern with `accept-encoding: identity`
