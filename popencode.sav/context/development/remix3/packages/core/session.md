<!-- Context: development/remix3/packages/core | Priority: critical | Version: 1.0 | Updated: 2026-04-25 -->

# session

Session management with multiple storage strategies, flash messages, and security features.

## Core Idea

Read session from request, modify it, save back to storage and write cookie to response. Supports memory, cookie, and filesystem storage.

## Key Points

- **Storage**: `createMemorySessionStorage()`, `createCookieSessionStorage()`, `createFsSessionStorage()`
- **Flash Messages**: `session.flash('key', value)` persists for one request
- **Security**: `session.regenerateId()` prevents session fixation attacks
- **Destruction**: `session.destroy()` clears data and invalidates session
- **Signatures**: `createFsSessionStorage('/path')` requires signed cookies

## Quick Example

```ts
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

let storage = createCookieSessionStorage()

async function handler(cookie) {
  let session = await storage.read(cookie)
  session.set('count', (session.get('count') ?? 0) + 1)
  return {
    session,
    cookie: await storage.save(session),
  }
}

// Flash messages
session.flash('message', 'Success!') // Available on NEXT request only
```

## Session Regeneration (Security)

```ts
// After login, regenerate to prevent fixation
let session = await storage.read(cookie)
session.set('userId', user.id)
session.regenerateId() // New session ID
// OR session.regenerateId(true) to destroy old session data
```

## Reference

`/home/lucky/remix/packages/session/README.md`