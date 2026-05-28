<!-- Context: development/remix3/cookie/guides/parse-and-serialize | Priority: high | Version: 1.0 -->

# Guide: Parse & Serialize Flow

**Purpose**: How `Cookie.parse()` and `Cookie.serialize()` process values with encoding, signing, and error handling.

## Parse Flow

```
Cookie header
  → null (if missing — returns null, no throw)
  → CookieHeader parse
    → header.get(name)
      → null (if not present — returns null)
      → value decode pipeline:
        base64-decode → unescape → decodeURIComponent → result
        ↓
        If signed: unsign() with each secret
          → first match wins; null if none match
        If empty string (''): return '' immediately
        If decode fails: return null (silent)
```

## Serialize Flow

```
value
  → '' (empty string? serialize as-is — clears the cookie)
  → encode pipeline:
    encodeURIComponent → unicode-escape → base64-encode
    ↓
    If signed: sign() with secrets[0]
  → new SetCookieHeader({...options})
  → toString()
```

## Per-Call Overrides

Pass `CookieProperties` as second arg to `serialize()` to override options for a single call:

```typescript
// Override maxAge for this serialization only
let header = await cookie.serialize('dark', { maxAge: 3600 })
```

## Error Handling

- **Missing header**: `parse()` returns `null` — no throw
- **Invalid signature**: `parse()` returns `null` — silent
- **Decode failure**: `parse()` returns `null` — silent
- **Missing cookie name**: `parse()` returns `null` — silent
- **Empty string**: `parse('')` returns `''` and `serialize('')` returns clear-cookie header

## Reference

- **Source**: `packages/cookie/src/lib/cookie.ts` — `Cookie.prototype.parse` and `Cookie.prototype.serialize`
- **Headers**: `packages/headers/src/lib/headers.ts` — `CookieHeader`, `SetCookieHeader`

## Related

- `cookie-class.md` — Class API overview
- `cookie-signing.md` — Signing internals
- `secret-rotation.md` — Changing secrets
