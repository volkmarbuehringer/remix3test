<!-- Context: development/remix3/cookie | Priority: medium | Version: 1.0 -->

# Cookie (@remix-run/cookie)

**Core Idea**: Type-safe cookie parsing and serialization with optional HMAC-SHA256 signing. Runtime-agnostic (Web Crypto API).

## Quick Routes

| Task | File |
|------|------|
| Cookie class API (name, domain, httpOnly, etc.) | `concepts/cookie-class.md` |
| HMAC-SHA256 signing & verification | `concepts/cookie-signing.md` |
| CookieOptions reference (secrets, encode/decode) | `lookup/cookie-options.md` |
| Parse & serialize flow with error handling | `guides/parse-and-serialize.md` |
| Secret rotation pattern | `guides/secret-rotation.md` |

## Related

- `../session/guides/cookie-storage.md` — Cookie-backed session storage
- `../core/concepts/remix-packages.md` — Package index (cookie row)
- `../../../../core/standards/concepts/security-patterns.md` — Security patterns
