<!-- Context: development/remix3/packages/middleware | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# session-middleware

Load and persist sessions in request context for fetch-router.

## Core Idea

Middleware that automatically reads session from request, makes it available via `context.get(Session)`, and writes cookie to response.

## Key Points

- **Auto Management**: Reads session, writes cookie automatically
- **Session Access**: `context.get(Session)` for session data
- **Signatures**: Uses signed cookies from `remix/session`
- **Flash Support**: Compatible with session flash messages

## Quick Example

```ts
import { session } from 'remix/session-middleware'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

let sessionCookie = createCookie('__session', {
  secrets: [env.SESSION_SECRET],
  httpOnly: true,
  secure: true,
})

let sessionStorage = createCookieSessionStorage()

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage)],
})

router.get('/profile', (context) => {
  let userSession = context.get(Session)
  let userId = userSession.get('userId')
  return Response.json({ userId })
})
```

## Reference

`/home/lucky/remix/packages/session-middleware/README.md`