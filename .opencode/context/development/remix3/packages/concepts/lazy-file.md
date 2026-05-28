<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Lazy File

**Purpose**: Lazy, streaming Blob/File implementation. Defers reading content until needed, ideal for streaming server environments.

**Key Points**:
- Deferred loading - contents loaded on demand
- Implements same interface as native Blob and File
- Convert to ReadableStream with `.stream()`, native File/Blob with `.toFile()`/`.toBlob()`
- Supports Blob.slice() even on streaming content
- Minimizes memory usage

**Minimal Example**:
```ts
import { LazyFile, type LazyContent } from 'remix/lazy-file'

let content: LazyContent = {
  byteLength: 100000,
  stream(start, end) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(readFromFile(start, end))
        controller.close()
      },
    })
  },
}

let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })
await lazyFile.arrayBuffer() // Lazy - reads on demand
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/lazy-file