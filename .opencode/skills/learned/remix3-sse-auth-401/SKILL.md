---
name: remix3-sse-auth-401
description: "Authenticate SSE endpoints in Remix 3 without breaking EventSource connections"
origin: auto-extracted
---

# SSE Authentication Without Redirect

**Extracted:** 2026-06-23
**Context:** Adding auth to Server-Sent Events endpoints in Remix 3 where EventSource can't follow HTTP redirects

## Problem

The `EventSource` JavaScript API cannot follow HTTP redirects (302). Using the standard `requireAuth()` middleware on an SSE endpoint causes the EventSource to silently fail — the browser receives a 302 redirect to the login page as the SSE response, triggers `onerror`, and stops reconnecting.

This makes SSE endpoints either unprotected (no auth) or broken (with standard requireAuth).

## Solution

Create a custom middleware that returns HTTP 401 instead of a 302 redirect for non-interactive clients:

```tsx
// app/middleware/sse-auth.ts
import type { Middleware } from 'remix/router'
import { Auth } from 'remix/middleware/auth'

export function requireSseAuth(): Middleware {
  return async (context, next) => {
    let auth = context.get(Auth)
    // Defensive check: no auth installed, bad session, or no user
    if (!auth || !('user' in auth) || !auth.user) {
      return new Response('Unauthorized', { status: 401 })
    }
    return next()
  }
}
```

Apply it to your SSE route handler:

```tsx
export const myEvents = createAction<typeof myEventsRoute, AppContext>(
  myEventsRoute,
  {
    middleware: [requireSseAuth()],
    handler: async (context) => myChannel.subscribe(context.request),
  },
)
```

This works because:
- The `Auth` context key is set by `loadAuth()` (router-level middleware), available to all routes
- `EventSource` receiving a 401 fires `onerror` but can retry if the user later authenticates
- The page that embeds the EventSource must already be behind `requireAuth()` — the SSE endpoint piggybacks on that session

### Auth state check behavior

| `auth` value | `context.get(Auth)` | Result |
|---|---|---|
| loadAuth() not installed | `undefined` | 401 |
| No valid session | `{ ok: false }` (no `user` prop) | 401 |
| Valid session | `{ user: {...} }` | passes through |

## When to Use

- Adding authentication to any SSE endpoint in a Remix 3 app
- Any route handler where the client is an EventSource, WebSocket, or other non-interactive consumer
- Replacing `requireAuth()` on streaming endpoints that can't handle redirects
