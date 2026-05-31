<!-- Context: frames/errors/missing-doctype-in-render | Priority: high | Version: 2.0 | Updated: 2026-05-01 -->

# Missing DOCTYPE in render() — Now Solved by createHtmlResponse

**Symptom**: Browser shows "Page is in Quirks Mode" warning.

**Root Cause** (historical): The `render()` function wasn't prepending `<!DOCTYPE html>` to the response stream.

## v1 Fix — Manual ReadableStream

```typescript
// ✅ v1 FIX - Manual doctype prepending via ReadableStream
export function render(node, init?) {
  let stream = renderToStream(node, { ... })
  let doctypeStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('<!DOCTYPE html>\n'))
    },
    async pull(controller) {
      let reader = stream.getReader()
      try {
        while (true) {
          let { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } finally {
        reader.releaseLock()
      }
      controller.close()
    },
  })
  return new Response(doctypeStream, { status, headers })
}
```

## v2 Fix — createHtmlResponse

```typescript
// ✅ v2 FIX - createHtmlResponse handles doctype + Content-Type
import { createHtmlResponse } from 'remix/response/html'

export function render(node, init?) {
  let stream = renderToStream(node, { ... })
  return createHtmlResponse(stream, init)
}
```

`createHtmlResponse` from `remix/response/html` automatically:
- Prepends `<!DOCTYPE html>` for Standards Mode
- Sets `Content-Type: text/html; charset=UTF-8`
- Handles string, Blob, BufferSource, and ReadableStream bodies

**Affected Files**: `bookstore/app/utils/render.tsx`, `my_app/app/utils/render.tsx`

## Key Rule

Always use `createHtmlResponse(stream, init)` instead of manually constructing a Response with ReadableStream doctype prepending.

## See Also

- `guides/render-utilities.md` — Full render utility guide
- `errors/resolve-frame-not-stripping-html.md` — Related HTML stripping
