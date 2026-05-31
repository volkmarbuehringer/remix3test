---
title: CORS Middleware Gotchas
category: errors
type: context
source: /home/lucky/remix/packages/cors-middleware/src/index.ts
tags: [remix3, errors, cors, middleware, gotchas]
---

# CORS Middleware Gotchas

## Core Concept
Common pitfalls when using Remix's CORS middleware, including preflight handling and credential inclusion. Prevents misconfigured CORS that breaks client requests.

## Common Issues

### Wildcard Origin Disables Credentials
❌ **Wrong**:
```ts
app.use(cors({ origin: '*', credentials: true }))
// Browsers block credentials with wildcard origin
```

✅ **Correct**:
```ts
app.use(cors({ origin: ['https://my-app.com'], credentials: true }))
```

### Forgetting Custom Headers in AllowedHeaders
❌ **Wrong**:
```ts
// Client sends X-Custom-Header but server doesn't allow it
app.use(cors({ origin: ['https://my-app.com'] }))
// Preflight fails with 405
```

✅ **Correct**:
```ts
app.use(cors({
  origin: ['https://my-app.com'],
  allowedHeaders: ['X-Custom-Header', 'Content-Type'],
}))
```

### Preflight Cache Duration Too Short
Set `maxAge` to reduce preflight requests:
```ts
app.use(cors({ maxAge: 86400 })) // 24 hours
```

## Reference
- [MDN CORS Preflight](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflight_request)
