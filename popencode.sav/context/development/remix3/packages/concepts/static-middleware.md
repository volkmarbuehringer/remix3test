<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Static Middleware

**Purpose**: Static file serving middleware for Remix. Serves static files from a directory with ETags, range requests, and conditional requests.

**Key Points**:
- ETag support (weak and strong)
- Range requests (HTTP 206 Partial Content)
- Conditional requests (If-None-Match, If-Modified-Since)
- Path traversal protection
- Automatic fallback to next middleware if file not found
- Cache control configuration

**Minimal Example**:
```ts
import { staticFiles } from 'remix/middleware/static'

let router = createRouter({
  middleware: [staticFiles('./public')],
})

// With cache control
staticFiles('./public', {
  cacheControl: 'public, max-age=31536000, immutable',
})

// Filter files
staticFiles('./public', {
  filter(path) { return !path.startsWith('.') },
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/static-middleware