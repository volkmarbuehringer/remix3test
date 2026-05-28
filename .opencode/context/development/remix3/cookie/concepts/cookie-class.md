<!-- Context: development/remix3/cookie/concepts/cookie-class | Priority: critical | Version: 1.0 -->

# Concept: Cookie Class

**Purpose**: `Cookie` class for type-safe cookie creation, parsing, and serialization with optional signing.

## Core Idea

`Cookie` encapsulates a cookie's name, its options (domain, path, secure, etc.), and provides `parse()` to read from a `Cookie` header and `serialize()` to produce a `Set-Cookie` header. Create via `new Cookie(name, opts)` or the `createCookie(name, opts)` factory.

## Key Points

- All options are read-only getters (`name`, `domain`, `expires`, `httpOnly`, `maxAge`, `partitioned`, `path`, `sameSite`, `secure`, `signed`)
- `sameSite` defaults to `'Lax'`, `path` defaults to `'/'`, `httpOnly` and `secure` default to `false`
- `signed` getter returns `true` if `secrets` were provided (length > 0)
- `partitioned: true` automatically sets `secure: true` per CHIPS spec
- `parse()` returns `null` (not throw) on missing header, missing name, invalid signature, or decode failure

## Quick Example

```typescript
import { createCookie } from 'remix/cookie'

let cookie = createCookie('session', {
  httpOnly: true,
  secrets: ['s3cret1'],
  secure: true,
})

let value = await cookie.parse(request.headers.get('Cookie'))
let setCookie = await cookie.serialize(value ?? '')
```

## Reference

- **Source**: `packages/cookie/src/lib/cookie.ts` — `Cookie` class + `createCookie` factory
- **Headers used**: `packages/headers/src/lib/headers.ts` — `CookieHeader`, `SetCookieHeader`

## Related

- `cookie-signing.md` — How signing works under the hood
- `cookie-options.md` — Full options reference
- `parse-and-serialize.md` — Parse/serialize flow details
