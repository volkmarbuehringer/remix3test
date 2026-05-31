<!-- Context: development/remix3/cookie/concepts/cookie-signing | Priority: high | Version: 1.0 -->

# Concept: Cookie Signing

**Purpose**: HMAC-SHA256 signing and verification for cookie integrity using Web Crypto API.

## Core Idea

Cookie values are signed with HMAC-SHA256 to detect tampering. The format is `{value}.{base64-hmac-signature}`. Uses `crypto.subtle.importKey` and `crypto.subtle.sign`/`verify` — works on Node, Bun, Deno, Cloudflare Workers.

## Key Points

- `sign(value, secret)` returns `value.base64-hmac` (base64 without padding `=` stripping)
- `unsign(cookie, secret)` returns original value or `false` if signature is invalid
- On parse: iterates all secrets in order, returns first valid match; `null` if none match
- Uses `lastIndexOf('.')` to split value from signature — supports dots in the value
- Serialization only uses `secrets[0]` (first secret wins for signing)

## Quick Example

```typescript
// sign.ts internals (simplified)
let signed = await sign('userId=123', 's3cret1')
// => "userId=123.aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"

let value = await unsign(signed, 's3cret1')
// => "userId=123" (or false if tampered)
```

## Reference

- **Source**: `packages/cookie/src/lib/sign.ts` — `sign` and `unsign` functions
- **Algorithm**: HMAC with SHA-256 via `crypto.subtle`

## Related

- `cookie-class.md` — Cookie class that uses signing
- `secret-rotation.md` — How to rotate secrets safely
- `../../core/concepts/remix-packages.md` — Package index
