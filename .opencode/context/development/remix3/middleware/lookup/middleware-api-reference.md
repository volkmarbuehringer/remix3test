---
title: Middleware API Reference
category: lookup
type: context
source: /home/lucky/remix/packages
tags: [remix3, lookup, reference, middleware, api]
---

# Middleware API Reference

## Core Concept
Quick reference for all Remix 3 middleware package APIs, including method signatures and configuration options.

## Middleware List

### Auth Middleware
```ts
auth(options?: AuthOptions) => Middleware
```

### CORS Middleware
```ts
cors(options?: CorsOptions) => Middleware
// CorsOptions: origin, credentials, maxAge, allowedHeaders
```

### CSRF Middleware
```ts
csrf(options?: CsrfOptions) => Middleware
// CsrfOptions: secret, tokenExpiration
```

### Compression Middleware
```ts
compression(options?: CompressionOptions) => Middleware
// CompressionOptions: brotli, gzip, threshold
```

### COP Middleware (CSP)
```ts
cop(options?: CopOptions) => Middleware
// CopOptions: directives, reportUri
```

### Logger Middleware
```ts
logger(options?: LoggerOptions) => Middleware
```

### Session Middleware
```ts
session(options?: SessionOptions) => Middleware
// SessionOptions: storage, cookie, autoRenew
```

## Reference
- [Remix Middleware Guide](https://remix.run/docs/en/main/guides/middleware)
