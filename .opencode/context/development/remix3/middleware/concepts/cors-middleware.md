---
title: CORS Middleware
category: concepts
type: context
source: /home/lucky/remix/packages/cors-middleware/src/index.ts
tags: [remix3, concepts, middleware, cors, security]
---

# CORS Middleware

## Core Concept
Middleware handling Cross-Origin Resource Sharing (CORS) for Remix APIs. Configurable origin whitelisting, header exposure, and preflight handling.

## Key Points
- Supports credentials and custom header exposure
- Auto-handles OPTIONS preflight requests
- Integrates with Remix's fetch router
- Provides `CorsOriginResolver` for dynamic origin validation
- Configurable allowed methods and headers

## Example
```ts
import { cors } from 'remix/cors-middleware'

app.use(cors({
  origin: ['https://my-app.com', 'https://admin.my-app.com'],
  credentials: true,
  maxAge: 86400 // 24 hours
}))
```

## Reference
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
