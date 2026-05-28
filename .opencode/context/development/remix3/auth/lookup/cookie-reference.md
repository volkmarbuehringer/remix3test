# Cookie API Reference

## `createCookie(name, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | required | Cookie name |
| `httpOnly` | `boolean` | `false` | Not accessible to JS |
| `secure` | `boolean` | `false` | HTTPS only |
| `sameSite` | `string` | — | `'lax'`, `'strict'`, or `'none'` |
| `secrets` | `string[]` | — | Signing keys (HMAC-SHA256). First signs, all verify |
| `path` | `string` | — | Cookie path |
| `domain` | `string` | — | Cookie domain |
| `maxAge` | `number` | — | Seconds until expiry |
| `expires` | `Date` | — | Explicit expiry |
| `encode` | `(value) => string` | `encodeURIComponent` | Custom encoding |
| `decode` | `(value) => string` | `decodeURIComponent` | Custom decoding |

## Methods

- `cookie.parse(cookieHeader)` — Parse and verify, returns parsed value or `null`
- `cookie.serialize(value)` — Serialize to `Set-Cookie` header string

## Secret Rotation

```ts
let cookie = createCookie('session', { secrets: ['new', 'old'] })
// Parsing: tries 'new' first, falls back to 'old'
// Serializing: always uses 'new' (first secret)
```

## Reference

- Full docs: `~/remix/packages/cookie/README.md`
- Import: `remix/cookie`
