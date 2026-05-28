---
title: Compression Middleware
category: concepts
type: context
source: /home/lucky/remix/packages/compression-middleware/src/index.ts
tags: [remix3, concepts, middleware, compression, performance]
---

# Compression Middleware

## Core Concept
Middleware compressing Remix server responses using gzip/brotli. Configurable compression level and content type filtering to reduce payload sizes.

## Key Points
- Supports gzip, brotli, and deflate compression algorithms
- Skips compression for small responses (<1KB by default)
- Configurable content type filtering
- Integrates with Remix's response pipeline
- Brotli preferred for modern clients with fallback to gzip

## Example
```ts
import { compression } from 'remix/compression-middleware'

app.use(compression({
  brotli: true,
  gzip: true,
  threshold: 1024 // don't compress responses smaller than 1KB
}))
```

## Reference
- [MDN Content-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
