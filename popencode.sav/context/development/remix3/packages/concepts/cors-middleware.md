<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: CORS Middleware

**Purpose**: CORS middleware for Remix. Adds standard CORS response headers and handles OPTIONS preflight requests.

**Key Points**:
- Automatic OPTIONS preflight handling (short-circuited with configurable status)
- `preflightContinue: true` lets downstream handlers process preflight requests
- `preflightStatusCode` sets custom status for short-circuited preflight (default 204)
- Flexible origin rules: static, regex, list, function-based `(origin, context)`
- Function-based `allowedHeaders(request)` with Vary header caveat
- Credential support with spec-safe origin reflection
- Private network preflight support

**Minimal Example**:
```ts
import { cors } from 'remix/middleware/cors'

let router = createRouter({
  middleware: [
    cors({
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    }),
  ],
})
```

**Dynamic Origin Policy**:
```ts
cors({
  origin(origin, context) {
    if (context.url.pathname.startsWith('/public/')) return '*'
    return origin.endsWith('.trusted.example')
  },
})
```

**Function-based allowedHeaders**:
```ts
cors({
  allowedHeaders(request) {
    let h = request.headers.get('Access-Control-Request-Headers')
    return h?.includes('x-admin-token')
      ? ['Authorization', 'Content-Type', 'X-Admin-Token']
      : ['Authorization', 'Content-Type']
  },
})
```

**Caveats**:
- CORS is browser-only; disallowed non-preflight requests still reach handlers
- `credentials: true` with `origin: '*'` reflects origin and adds `Vary: Origin`
- Function `allowedHeaders` varies on `Access-Control-Request-Headers`

**Reference**: https://github.com/remix-run/remix/tree/main/packages/cors-middleware
