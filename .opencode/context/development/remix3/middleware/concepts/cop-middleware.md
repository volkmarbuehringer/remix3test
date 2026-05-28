---
title: COP Middleware (Content Security Policy)
category: concepts
type: context
source: /home/lucky/remix/packages/cop-middleware/src/index.ts
tags: [remix3, concepts, middleware, csp, security]
---

# COP Middleware (Content Security Policy)

## Core Concept
Content Security Policy middleware for Remix 3. Generates and validates CSP headers for server-rendered pages using nonce-based or hash-based approaches.

## Key Points
- Supports nonce-based and hash-based CSP directives
- Auto-generates nonces for inline scripts/styles
- Reports CSP violations via configurable endpoint
- Integrates with Remix's response headers pipeline
- Provides `CopOptions` for fine-grained directive control

## Example
```ts
import { cop } from 'remix/cop-middleware'

app.use(cop({
  directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'nonce-123'"],
    'report-uri': ['/csp-report']
  }
}))
```

## Reference
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
