<!-- Context: development/remix3/guides/session-middleware | Priority: high | Version: 1.0 | Updated: 2026-03-23 -->

# Session Middleware

> Signed cookie sessions with automatic read/write lifecycle. Loads session state into `context.get(Session)` and persists changes automatically.

## Quick Reference

- **Use when**: Managing user sessions, login/logout
- **Key function**: `session()`
- **Stores**: Session data in signed cookies
- **Package**: `remix/session-middleware`

## Key Points

1. **Signed cookies** prevent session tampering
2. **Auto-read/write**: Middleware handles cookie parsing and persistence
3. **`context.get(Session)`** gives access to session APIs
4. **Flash messages** with `session.flash()`
5. **Session regeneration** with `session.regenerateId()`

## Pattern: Setup

```typescript
import { createCookie } from 'remix/cookie'
import { session } from 'remix/session-middleware'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

let sessionCookie = createCookie('__session', {
  secrets: ['s3cr3t'], // Required for signing
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
})

let sessionStorage = createCookieSessionStorage()

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage)],
})
```

## Pattern: File System Session Storage

```typescript
import * as fs from 'node:fs'
import { createCookie } from 'remix/cookie'
import { createFsSessionStorage } from 'remix/session/fs-storage'

const SESSION_DIR = 'tmp/sessions'
fs.mkdirSync(SESSION_DIR, { recursive: true })

export const sessionStorage = createFsSessionStorage(SESSION_DIR)
export const sessionCookie = createCookie('session', {
  secrets: ['your-secret-key'],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 2592000,
  path: '/',
})
```

### Key Differences

| Storage Type | Use Case | Limitations |
|--------------|----------|-------------|
| Cookie | Small data, stateless | Size limit (~4KB) |
| File System | Large data, persistence | Requires filesystem access |

## Pattern: Login/Logout

```typescript
// Login
router.post('/login', ({ get }) => {
  let session = get(Session)
  let formData = get(FormData)

  let user = authenticateUser(formData.get('username'), formData.get('password'))
  if (!user) {
    session.flash('error', 'Invalid credentials')
    return redirect('/login')
  }

  session.regenerateId() // Prevent session fixation
  session.set('userId', user.id)
  return redirect('/dashboard')
})

// Logout
router.post('/logout', ({ get }) => {
  let session = get(Session)
  session.destroy()
  return redirect('/')
})
```

## Pattern: Read Session Data

```typescript
router.get('/profile', ({ get }) => {
  let session = get(Session)
  let userId = session.get('userId')

  if (!userId) return redirect('/login')

  let user = users.getById(userId)
  return Response.json({ user })
})
```

## Session APIs

| Method                      | Purpose                                |
| --------------------------- | -------------------------------------- |
| `session.get(key)`          | Read value                             |
| `session.set(key, value)`   | Write value                            |
| `session.flash(key, value)` | Set flash message (cleared after read) |
| `session.unset(key)`        | Remove value                           |
| `session.regenerateId()`    | New session ID (security)              |
| `session.destroy()`         | Clear all data                         |

## Security Notes

- **Always sign cookies**: `secrets` is required
- **Regenerate on login**: Prevents session fixation attacks
- **Flash for errors**: Temporary messages

## Anti-Patterns

❌ **Don't**: `createCookie('session', { secrets: [] })` — no signing = tampered sessions
✅ **Do**: `createCookie('__session', { secrets: ['s3cr3t'] })`

## 📂 Codebase References

**Package**: `packages/session-middleware/README.md` — Full documentation  
**Cookie**: `packages/cookie/README.md` — Cookie options

## Related Files

- `guides/auth-middleware.md` — Auth resolution
- `guides/typed-context.md` — Context typing
