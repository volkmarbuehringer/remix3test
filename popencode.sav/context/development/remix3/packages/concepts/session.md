<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Session

**Purpose**: Session management for JavaScript. Flexible and secure session management with multiple storage strategies.

**Key Points**:
- Multiple storage strategies: memory, cookie, filesystem
- Flash messages that persist for one request
- Session security: regenerate IDs after privilege changes
- Session fixation protection
- Storage interfaces: createCookieSessionStorage, createFsSessionStorage, createMemorySessionStorage

**Minimal Example**:
```ts
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

let storage = createCookieSessionStorage()

async function handleRequest(cookie) {
  let session = await storage.read(cookie)
  session.set('count', Number(session.get('count') ?? 0) + 1)
  return {
    session,
    cookie: await storage.save(session),
  }
}

// Flash messages
session.flash('message', 'success!') // Available on next request

// Security: regenerate after login
session.regenerateId()
session.set('userId', user.id)
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/session