<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Cookie

**Purpose**: Type-safe cookie parsing and serialization with HMAC-SHA256 signing and secret rotation.

**Key Points**:
- Secure signing with HMAC-SHA256
- Secret rotation without breaking existing cookies
- Web Standards compliant (works in Node, Bun, Deno, Cloudflare Workers)
- Custom encoding via encodeURIComponent/decodeURIComponent

**Minimal Example**:
```ts
import { createCookie } from 'remix/cookie'

let sessionCookie = createCookie('session', {
  httpOnly: true,
  secrets: ['s3cret1'],
  secure: true,
})

// Parse cookie from request
let value = await sessionCookie.parse(request.headers.get('Cookie'))

// Serialize cookie for response
let setCookie = await sessionCookie.serialize(value)
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/cookie