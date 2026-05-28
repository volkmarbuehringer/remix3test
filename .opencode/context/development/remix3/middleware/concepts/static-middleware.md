---
title: Static Middleware
category: concepts
type: context
source: /home/lucky/remix/packages/static-middleware/src/index.ts
tags: [remix3, concepts, middleware, static-files, caching]
---

# Static Middleware

## Core Concept
Middleware serving static files from Remix's public directory. Supports cache control and conditional requests with ETag support.

## Key Points
- Serves files from configurable root directory
- Sets `Cache-Control` headers based on file type
- Handles 304 Not Modified responses with ETag/Last-Modified
- Supports directory index fallback
- Integrates with Remix's compression middleware

## Example
```ts
import { staticFiles } from 'remix/static-middleware'

app.use(staticFiles({
  root: './public',
  maxAge: 86400, // 24 hours for most files
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
  }
}))
```

## Reference
- [MDN Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
