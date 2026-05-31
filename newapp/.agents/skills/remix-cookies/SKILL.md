---
name: remix-cookies
description: Use `remix/cookie` for signed cookies with secret rotation. Activate when setting or reading cookies that need tamper protection, or when managing cookie attributes like httpOnly, sameSite, secure.
---

# Remix Cookies

Covers `remix/cookie`.

## Creating Cookies

```ts
import { createCookie } from 'remix/cookie'

let cookie = createCookie('session', {
  httpOnly: true,
  secrets: ['s3cret1'],
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 3600,
})
```

## Signing and Secret Rotation

Cookies are HMAC-SHA256 signed. Pass multiple secrets for rotation — the first signs new cookies, others verify existing ones:

```ts
let cookie = createCookie('session', {
  secrets: ['new-secret', 'old-secret'],
})
```

## Reading and Writing

```ts
let value = await cookie.parse(request.headers.get('Cookie'))
let header = await cookie.serialize('user-123')
let destroyHeader = await cookie.destroy()
```

## References

- `~/remix/packages/cookie/README.md` — full API, signing, rotation examples
- `~/remix/packages/session/README.md` — higher-level session abstraction built on cookies
