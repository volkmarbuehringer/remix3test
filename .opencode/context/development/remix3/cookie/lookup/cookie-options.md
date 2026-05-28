<!-- Context: development/remix3/cookie/lookup/cookie-options | Priority: high | Version: 1.0 -->

# Lookup: CookieOptions Reference

**Purpose**: All configuration options for `createCookie` / `new Cookie`.

## CookieOptions Interface

```typescript
interface CookieOptions extends CookieProperties {
  decode?: (value: string) => string  // default: decodeURIComponent
  encode?: (value: string) => string  // default: encodeURIComponent
  secrets?: string[]                   // default: [] (no signing)
}
```

## CookieProperties (from @remix-run/headers)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `domain` | `string` | `undefined` | Cookie domain scope |
| `expires` | `Date` | `undefined` | Absolute expiration |
| `httpOnly` | `boolean` | `false` | Restrict to HTTP(S) only |
| `maxAge` | `number` | `undefined` | Max age in seconds |
| `partitioned` | `boolean` | `false` | CHIPS partitioned (sets `secure: true`) |
| `path` | `string` | `'/'` | URL path scope |
| `sameSite` | `'Strict'\|'Lax'\|'None'` | `'Lax'` | SameSite attribute |
| `secure` | `boolean` | `false` | HTTPS-only |

## Reference

- **Source**: `packages/cookie/src/lib/cookie.ts` — CookieOptions type
- **Headers**: `packages/headers/src/lib/headers.ts` — CookieProperties

## Related

- `cookie-class.md` — How options are used
- `parse-and-serialize.md` — Encode/decode in parse/serialize
