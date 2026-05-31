<!-- Context: development/remix3/packages/middleware | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# auth-middleware

Request authentication and route protection helpers for Remix.

## Core Idea

Middleware that resolves session data into current user and protects routes. Pairs with `remix/auth` for complete auth flow.

## Key Points

- **Session Schemes**: `createSessionAuthScheme()` reads/writes user from session
- **Route Protection**: `requireAuth()` redirects unauthenticated users
- **Auth Context**: `context.get(Auth)` provides current user identity
- **Typed Helpers**: `WithAuth`, `WithRequiredAuth` for context types

## Quick Example

```ts
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'

let router = createRouter({
  middleware: [
    auth({
      schemes: [
        createSessionAuthScheme({
          read(session) {
            return session.get('auth') as { userId: string } | null
          },
          verify(value) {
            return users.getById(value.userId)
          },
          invalidate(session) {
            session.unset('auth')
          },
        }),
      ],
    }),
  ],
})

// Protected route
router.get('/dashboard', {
  middleware: [requireAuth()],
  handler(context) {
    let auth = context.get(Auth)
    return Response.json({ id: auth.identity.id })
  },
})
```

## Reference

`/home/lucky/remix/packages/auth-middleware/README.md`