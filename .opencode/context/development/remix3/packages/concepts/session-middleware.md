<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Session Middleware

**Purpose**: Signed-cookie session middleware. Loads session from requests, exposes via `context.session` (primary) or `context.get(Session)` (fallback), persists automatically on response.

**Key Points**:
- Reads and saves session per request; auto-sets response cookie
- Primary API: `context.session` (or `context.get(Session)`)
- Lifecycle: `session.get(key)`, `session.set(key, val)`, `session.flash(key, val)` (read-once), `session.regenerateId()` (session rotation), `session.destroy()` (logout)
- Cookie must be signed (`secrets`); recommended security: `httpOnly: true, secure: true, sameSite: 'lax'`
- Pluggable storage via `createCookieSessionStorage()` and other backends

**Minimal Example**:
```ts
import { session } from 'remix/middleware/session'
import { createCookie } from 'remix/cookie'
import { createCookieSessionStorage } from 'remix/session-storage/cookie'

let cookie = createCookie('__session', {
  secrets: ['s3cr3t'], httpOnly: true, secure: true, sameSite: 'lax',
})
let router = createRouter({ middleware: [session(cookie, createCookieSessionStorage())] })

router.post('/login', ({ get, session }) => {
  let user = authenticate(get(FormData).get('username'), get(FormData).get('password'))
  if (!user) { session.flash('error', 'Invalid credentials'); return redirect('/login') }
  session.regenerateId(); session.set('userId', user.id); return redirect('/dashboard')
})

router.post('/logout', ({ session }) => { session.destroy(); return redirect('/') })
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/session-middleware
