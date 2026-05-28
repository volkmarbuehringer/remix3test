<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Multipart Parser

**Purpose**: Fast streaming multipart parsing. Processes incrementally without buffering entire payload.

**Key Points**:
- File upload parsing (multipart/form-data)
- Full multipart/* support (mixed, alternative, related)
- API with arrayBuffer, bytes, text, size, metadata
- Built-in limits to prevent abuse
- First-class Node.js support
- Demos for Bun, Deno, Node, Cloudflare Workers
- Faster than busboy in benchmarks

**Minimal Example**:
```ts
import { parseMultipartRequest } from 'remix/multipart-parser'

for await (let part of parseMultipartRequest(request)) {
  if (part.isFile) {
    console.log(`File: ${part.filename}, size: ${part.bytes.byteLength}`)
    await saveFile(part.filename, part.bytes)
  } else {
    console.log(`Field: ${part.name} = ${part.text}`)
  }
}
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/multipart-parser