<!-- Context: development/remix3/concepts/server-rendering | Priority: medium | Version: 3.0 | Updated: 2026-05-03 -->

# Server Rendering

Render components to HTML on the server with two APIs: blocking and streaming.

## Core Idea

`renderToString` buffers the entire response; `renderToStream` sends initial HTML immediately and streams frame content as it resolves.

## Key Points

- `renderToString(App)` - Complete HTML string (static pages, emails)
- `renderToStream(App, options)` - Streaming response for progressive loading
- `frameSrc` seeds SSR frame state; `resolveFrame` fetches frame HTML
- Frames without `fallback` block streaming; frames with `fallback` stream non-blocking
- CSS styles collected and emitted as `<style>` tag in head
- Use `new Response(stream, init)` with explicit `Content-Type: text/html; charset=UTF-8` instead of `createHtmlResponse`

## Quick Example

```tsx
import { renderToStream } from 'remix/ui/server'

let stream = renderToStream(<App />, {
  frameSrc: request.url,
  resolveFrame(src, target) {
    return fetchHtml(target ? { url: new URL(src, request.url), target } : new URL(src, request.url))
  },
})

let headers = new Headers()
headers.set('Content-Type', 'text/html; charset=UTF-8')
return new Response(stream, { headers })
```

## Response Pattern Evolution

| Version | Pattern | Notes |
|---------|---------|-------|
| **v1** | Manual `new Response` with ReadableStream doctype prepending | Fragile, error-prone |
| **v2** | `createHtmlResponse(stream, init)` from `remix/response/html` | Handles DOCTYPE + Content-Type automatically |
| **v3 (current)** | `new Response(stream, { ...init, headers })` with explicit `Content-Type` | Removes dependency, explicit header merging |

`createHtmlResponse` is still exported from `remix/response/html` and remains a valid option. The `new Response` pattern is preferred in `my_app` and `bookstore` for reduced dependencies and explicit header control.

## Related

- `guides/render-utilities.md` — Full render utility guide
- `guides/frame-resolution.md` — resolveFrame patterns

## Reference

`/home/lucky/remix/packages/component/docs/server-rendering.md`