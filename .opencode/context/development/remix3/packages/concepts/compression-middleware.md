<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Compression Middleware

**Purpose**: Response compression middleware for Remix. Negotiates br, gzip, and deflate from Accept-Encoding.

**Key Points**:
- Encoding negotiation (br > gzip > deflate)
- Compression guards (skips already-compressed, range-enabled)
- Configurable size threshold (default 1024 bytes)
- MIME filtering via `filterMediaType` option
- `encodings` option supports arrays and per-response functions
- zlib/Brotli compression options (static or per-response functions)

**Minimal Example**:
```ts
import { compression } from 'remix/middleware/compression'

let router = createRouter({
  middleware: [compression()],
})
```

**Options**:
```ts
// Custom threshold
compression({ threshold: 2048 })

// Filter media types
compression({
  filterMediaType(mediaType) {
    return mediaType === 'application/vnd.example+data'
  },
})

// Per-response encoding customization
compression({
  encodings: (response) => {
    let ct = response.headers.get('Content-Type')
    return ct?.startsWith('text/event-stream;')
      ? ['gzip', 'deflate']
      : ['br', 'gzip', 'deflate']
  },
})

// zlib/Brotli options (static or per-response functions)
compression({
  zlib: { level: 6 },
  brotli: (response) => ({
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
  }),
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/compression-middleware
