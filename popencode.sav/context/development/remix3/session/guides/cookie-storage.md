<!-- Context: development/remix3/session/guides/cookie-storage | Priority: medium | Version: 1.0 -->

# Guide: Cookie Session Storage

**Core**: `createCookieSessionStorage` serializes all session data into a signed cookie. No server-side storage needed — ideal for stateless deployments and small payloads.

## Core Concept

Data is JSON-serialized entirely into the cookie. The ~4096 byte browser limit applies. Since there is no server-side store, `regenerateId(true)` cannot delete old sessions — it logs a warning instead.

## Key Points

- **Imports from**: `remix/session/cookie-storage`
- **Size limit**: ~4096 bytes total (browser cookie max)
- **No server storage**: Fully stateless, no cleanup needed
- **regenerateId(true)**: Warns instead of deleting — no server-side old session to remove
- **Returns `''`** on destroy (clear cookie), `null` if clean, cookie string if dirty

## Quick Example

```typescript
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

let storage = createCookieSessionStorage()
let session = await storage.read(cookieHeader)
session.set('theme', 'dark')
let cookie = await storage.save(session) // serialized JSON in cookie value
```

## Reference

- **Source**: `packages/session/src/lib/session-storage/cookie.ts` — `createCookieSessionStorage`

## Related

- `session-storage-interface.md` — Interface contract
- `session-security.md` — Regeneration limitations with cookie storage
- `../../auth/concepts/session-access.md` — Middleware session access
