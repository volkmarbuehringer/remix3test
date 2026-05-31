<!-- Context: development/remix3/packages/core | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# cookie

Type-safe cookie parsing and serialization with HMAC-SHA256 signing and secret rotation.

## Core Idea

Create cookies with cryptographic signing to prevent tampering. Supports secret rotation for zero-downtime key updates.

## Key Points

- **Signing**: Automatic when `secrets` option provided
- **Secret Rotation**: Add new secret to front of array; existing cookies still parse
- **Encoding**: Uses `encodeURIComponent`/`decodeURIComponent` by default; customizable
- **Runtime Agnostic**: Works in Node.js, Bun, Deno, Cloudflare Workers

## Quick Example

```ts
import { createCookie } from 'remix/cookie'

// Basic cookie
let cookie = createCookie('session', {
  httpOnly: true,
  secrets: ['s3cret1'],
  secure: true,
})

// Parse from request
let value = await cookie.parse(request.headers.get('Cookie'))

// Serialize to response
let response = new Response('Hello', {
  headers: { 'Set-Cookie': await cookie.serialize(value) },
})
```

## Secret Rotation

```ts
// Start with one secret
cookie = createCookie('session', { secrets: ['secret1'] })

// Rotate: add new secret to front (existing cookies still work)
cookie = createCookie('session', { secrets: ['secret2', 'secret1'] })
// New cookies signed with secret2, existing cookies signed with secret1
```

## Reference

`/home/lucky/remix/packages/cookie/README.md`