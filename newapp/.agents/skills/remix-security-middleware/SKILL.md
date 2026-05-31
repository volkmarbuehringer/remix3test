---
name: remix-security-middleware
description: Protect Remix apps with CSRF tokens, CORS policies, and cross-origin protection. Activate when adding security middleware to your router stack.
---

# Remix Security Middleware

Covers `remix/middleware/csrf`, `remix/middleware/cors`, `remix/middleware/cop`.

## CSRF Protection

Session-backed synchronizer token validation:

```ts
import { csrf, getCsrfToken } from 'remix/middleware/csrf'

let router = createRouter({
  middleware: [session(cookie, storage), csrf()],
})
```

Token sources (by default): `X-Csrf-Token` header > `_csrf` form field > `_csrf` query param. Requires `session-middleware` to run first.

## CORS

```ts
import { cors } from 'remix/middleware/cors'

let router = createRouter({
  middleware: [cors({ origin: 'https://app.example.com' })],
})
```

## Cross-Origin Protection (COP)

Tokenless protection using browser provenance headers (`Sec-Fetch-*`):

```ts
import { crossOriginProtection } from 'remix/middleware/cop'

let router = createRouter({
  middleware: [crossOriginProtection()],
})
```

## References

- `~/remix/packages/csrf-middleware/README.md` — CSRF token sources, origin validation, caveats
- `~/remix/packages/cors-middleware/README.md` — CORS options and configuration
- `~/remix/packages/cop-middleware/README.md` — tokenless cross-origin protection
- `~/remix/packages/session-middleware/README.md` — required by csrf()
