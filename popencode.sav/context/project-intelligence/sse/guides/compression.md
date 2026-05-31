<!-- Context: sse/guides/compression | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Compression Middleware Guide

HTTP response compression for SSE streams using `remix/compression-middleware`.

## Overview

Compression reduces bandwidth usage by encoding responses with gzip/deflate. SSE streams benefit significantly since they send continuous text data.

## Usage

```typescript
import { createRouter } from 'remix/fetch-router'
import { compression } from 'remix/compression-middleware'

let router = createRouter({
  middleware: [compression()],
})
```

## How It Works

1. Client sends `Accept-Encoding` header listing supported encodings
2. Server selects best match (gzip, deflate, or none)
3. Response includes `Content-Encoding` header
4. Server compresses response body before sending

## Verification

Check DevTools Network tab for `Content-Encoding: gzip` response header.

## SSE Headers

Compression works with SSE-specific headers:

```typescript
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Content-Encoding': 'gzip', // Added by middleware
  },
})
```

## Performance Impact

| Metric       | Without Compression | With gzip  |
| ------------ | ------------------- | ---------- |
| Bandwidth    | 100%                | ~30-40%    |
| CPU Overhead | None                | ~5-10%     |
| Latency      | Baseline            | Negligible |

## Configuration

```typescript
compression({
  // Minimum response size to compress (bytes)
  threshold: 1024,

  // Level: 1 (fast) to 9 (smallest)
  level: 6,
})
```

## Edge Cases

- **Small responses**: Below threshold, sent uncompressed
- **Binary streams**: Not compressed (streams already encoded)
- **Client limits**: Falls back if client doesn't support compression

## 📂 Codebase References

**Middleware**: `packages/compression-middleware/src/index.ts`
**Demo Usage**: `demos/sse/app/router.tsx` - Line 146
