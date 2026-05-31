<!-- Context: development/remix3/guides/auth-security | Priority: high | Version: 1.0 | Updated: 2026-04-11 -->

# Auth Security Patterns

Security best practices for authentication middleware.

## Pattern: Database Middleware

For auth schemes that need database access:

```typescript
export function loadDatabase(): Middleware {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}

// Usage in auth.ts
export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme({
        read(session) { return parseFrameAuthSession(session.get('auth')) },
        async verify(value, context) {
          let db = context.get(Database)
          return await db.find(users, value.userId)
        },
        invalidate(session) { session.unset('auth') },
      }),
    ],
  })
}
```

## Pattern: Session Fixation Prevention

Regenerate session ID after authentication:

```typescript
export async function login({ request, get }) {
  let session = get(Session)
  // ... validate credentials ...
  await session.regenerateId(true)
  session.set('auth', { userId: user.id })
  return redirect(routes.dashboard.href())
}
```

## Pattern: Generic Error Messages

Don't expose whether an email exists:

```typescript
// ❌ WRONG - Exposes user enumeration
if (!user) return new Response('User not found', { status: 401 })
if (!validPassword) return new Response('Invalid password', { status: 401 })

// ✅ CORRECT - Generic message
if (!user || !validPassword) {
  return new Response('Invalid credentials', { status: 401 })
}
```

## Security Checklist

- [ ] Session ID regenerated after login
- [ ] Generic auth error messages (no email enumeration)
- [ ] Proper HTTP status codes (401 unauthorized, 403 forbidden)
- [ ] Rate limiting on auth endpoints
- [ ] Secure session cookie settings (httpOnly, secure, sameSite)

## Related

- `guides/auth-middleware.md` - Core auth patterns
- `guides/session-middleware.md` - Session management
