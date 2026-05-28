# Lazy File

A lazy, streaming `Blob`/`File` implementation that defers reading contents until needed. Ideal for large files that don't fit in memory.

## Key Points

- **Deferred Loading**: File contents loaded on demand — minimizes memory usage
- **Familiar Interface**: `LazyBlob`/`LazyFile` implement the same API as native `Blob`/`File`
- **Streaming**: `.stream()` returns `ReadableStream` for Response and streaming APIs
- **Conversion**: `.toFile()`/`.toBlob()` for non-streaming APIs (buffers entire file)
- **Slice Support**: `.slice()` works even on streaming content

## Quick Example

```ts
import { LazyFile, type LazyContent } from 'remix/lazy-file'

// Stream content from anywhere
let content: LazyContent = {
  byteLength: 100000,
  stream(start, end) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('X'.repeat(100000).slice(start, end))
        controller.close()
      },
    })
  },
}

let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })

// Stream for HTTP response
let response = new Response(lazyFile.stream(), {
  headers: { 'Content-Type': lazyFile.type, 'Content-Length': String(lazyFile.size) },
})
```

## Reference

- Full docs: `~/remix/packages/lazy-file/README.md`
- Import: `remix/lazy-file`

## Related

- [fs](../concepts/fs.md) — `openLazyFile()` opens filesystem files as LazyFile
- [response](../concepts/response.md) — `createFileResponse()` accepts LazyFile
- [file-storage](../data/concepts/file-storage.md) — Stores/retrieves LazyFile objects
