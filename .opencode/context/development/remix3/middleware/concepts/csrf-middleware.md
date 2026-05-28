---
title: CSRF Middleware
category: concepts
type: context
source: /home/lucky/remix/packages/csrf-middleware/src/index.ts
tags: [remix3, concepts, middleware, csrf, security]
---

# CSRF Middleware

## Core Concept
Middleware preventing Cross-Site Request Forgery (CSRF) attacks for Remix form submissions. Uses double-submit cookie pattern with configurable token expiration.

## Key Points
- Generates CSRF tokens for HTML forms via `getCsrfToken()`
- Validates tokens on state-changing requests (POST, PUT, DELETE)
- Configurable token expiration and secret rotation
- Provides `CsrfTokenResolver` for custom token generation
- Integrates with Remix's session middleware for token storage

## Example
```ts
import { csrf, getCsrfToken } from 'remix/csrf-middleware'

app.use(csrf({ secret: process.env.CSRF_SECRET }))

// In route loader:
export function loader() {
  return { csrfToken: getCsrfToken() }
}
```

## Reference
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
