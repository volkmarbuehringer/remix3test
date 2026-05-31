<!-- Context: project-intelligence/checker/guides/login-implementation | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# Login Implementation Guide

Complete session-based authentication for Remix 3 using the checker project patterns.

## Architecture Overview

**Three-layer middleware stack:**
1. **Session** - Cookie management + file system storage
2. **Database** - Injects Database into context
3. **Auth** - Resolves identity from session via database lookup

## Implementation Steps

### 1. Session Middleware

```typescript
// app/middleware/session.ts
import { createCookie } from 'remix/cookie'
import { createFsSessionStorage } from 'remix/session/fs-storage'

export const sessionCookie = createCookie('session', {
  secrets: [process.env.SESSION_SECRET ?? 'dev-secret'],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 2592000, // 30 days
  path: '/',
})

export const sessionStorage = createFsSessionStorage('./tmp/sessions')
```

### 2. Database Middleware

```typescript
// app/middleware/database.ts
import { Database } from 'remix/data-table'

export function loadDatabase() {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
```

### 3. Auth Middleware

```typescript
// app/middleware/auth.ts
import { auth, createSessionAuthScheme } from 'remix/auth-middleware'

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme({
        read(session) {
          return session.get('auth') as { userId: number } | null
        },
        async verify(value, context) {
          let db = context.get(Database)
          return await db.find(users, value.userId)
        },
      }),
    ],
  })
}
```

### 4. Router Setup

```typescript
// app/router.ts
const middleware = [
  formData(),
  session(sessionCookie, sessionStorage),
  loadDatabase(),
  loadAuth(),
]
```

### 5. Login Controller

```typescript
// POST handler
async action({ get, url }) {
  let db = get(Database)
  let session = get(Session)
  let formData = get(FormData)
  
  // Validate credentials
  let user = await authenticate(db, formData)
  if (!user) {
    session.flash('error', 'Invalid email or password')
    return redirect('/login')
  }
  
  // Success: regenerate session ID
  await session.regenerateId(true)
  session.set('auth', { userId: user.id })
  return redirect(getPostAuthRedirect(url))
}
```

## Security Checklist

- [ ] SESSION_SECRET set in production
- [ ] Session ID regenerated on login
- [ ] Generic error messages (no user enumeration)
- [ ] returnTo validated (prevent open redirects)
- [ ] httpOnly, sameSite cookies

## 📂 Codebase References

**Implementation:**
- `checker/app/middleware/session.ts` - Session cookie + FS storage
- `checker/app/middleware/database.ts` - Database context injection
- `checker/app/middleware/auth.ts` - Auth middleware with SKIP_AUTH support
- `checker/app/controllers/auth/login/controller.tsx` - Login logic
- `checker/app/controllers/auth/login/page.tsx` - Login UI
- `checker/app/router.ts` - Middleware chain setup

**Data Layer:**
- `checker/app/data/schema.ts` - Users table with hooks

## Related

- `lookup/import-conventions.md` - Critical import rules
- `guides/testing-with-skip-auth.md` - Testing patterns
- `concepts/middleware-composition.md` - Middleware patterns
