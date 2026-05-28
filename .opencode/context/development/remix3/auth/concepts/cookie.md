# Cookie

Type-safe cookie parsing and serialization with secure signing, secret rotation, and complete cookie attribute control.

## Key Points

- **Signing**: HMAC-SHA256 signing prevents tampering when `secrets` option is provided
- **Secret Rotation**: Pass multiple secrets; newest first signs, older ones still verify
- **Web Standards**: Built on Web Crypto API — works Node.js, Bun, Deno, Cloudflare Workers
- **Custom Encoding**: Override `encode`/`decode` for human-readable cookie values in dev tools

## Quick Example

```ts
import { createCookie } from 'remix/cookie'

let sessionCookie = createCookie('session', {
  httpOnly: true,
  secrets: ['s3cret1'],
  secure: true,
})

// Parse from request
let value = await sessionCookie.parse(request.headers.get('Cookie'))

// Set in response
let response = new Response('Hello', {
  headers: {
    'Set-Cookie': await sessionCookie.serialize(value),
  },
})
```

## Reference

- Full docs: `~/remix/packages/cookie/README.md`
- Import: `remix/cookie`

## Related

- [session](../../packages/concepts/session.md) — Session management using cookies for storage
- [session-middleware guide](../guides/session-middleware.md)
