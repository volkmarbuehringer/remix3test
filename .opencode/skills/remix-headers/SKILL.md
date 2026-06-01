---
name: remix-headers
description: Use typed HTTP header manipulation with `remix/headers`. Activate when parsing, modifying, or constructing HTTP headers with type safety — Cache-Control, Content-Type, Set-Cookie, Accept, Range, and more.
---

# Remix HTTP Headers

Covers `remix/headers`.

## SuperHeaders

Extends native `Headers` with lazy typed property accessors:

```ts
import Headers from 'remix/headers'

let headers = new Headers(request.headers)
headers.contentType = { mediaType: 'text/html', charset: 'utf-8' }
headers.cacheControl = { public: true, maxAge: 3600 }
headers.setCookie = { name: 'session', value: 'abc', httpOnly: true }
```

Pass directly to `new Response(body, { headers })` — it's a real `Headers` subclass.

Use `headers.apply(...)` to merge header values with proper semantics (appends `Set-Cookie`, combines `Vary`, etc.).

## Individual Header Classes

Import standalone parsers without SuperHeaders:

```ts
import { ContentType } from 'remix/headers/content-type'
import { SetCookie } from 'remix/headers/set-cookie'
import { CacheControl } from 'remix/headers'
```

Supported: `Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Disposition`, `Content-Range`, `Content-Type`, `Cookie`, `If-Match`, `If-None-Match`, `If-Range`, `Range`, `Set-Cookie`, `Vary`.

## Raw Headers

```ts
import { parse, stringify } from 'remix/headers'
let h = parse('Content-Type: text/html\r\nCache-Control: no-cache')
stringify(h) // 'Content-Type: text/html\r\nCache-Control: no-cache'
```

## References

- `~/remix/packages/headers/README.md` — full docs with per-header examples
