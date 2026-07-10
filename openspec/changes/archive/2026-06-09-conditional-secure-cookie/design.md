## Context

The session cookie is configured in `app/middleware/session.ts`:

```ts
export const sessionCookie = createCookie('session', {
  secrets: [sessionSecret],
  secure: true,
  httpOnly: true,
  sameSite: 'Strict',
  maxAge: 2592000,
  path: '/',
})
```

The `secure: true` flag instructs the browser to only send this cookie over HTTPS connections. This is correct for production but breaks local/mobile development over HTTP because:

1. The `Secure` cookie is never sent by the browser on HTTP
2. The server creates a new anonymous session per request
3. CSRF tokens stored in the session are never reusable across requests

Desktop localhost is exempt from this restriction per browser spec, which is why the bug only manifests on mobile devices.

## Goals / Non-Goals

**Goals:**

- Session cookies work over HTTP in development
- Session cookies remain Secure-only in production
- Zero behavioral change for production users

**Non-Goals:**

- Changing the session secret rotation or cookie name
- Adding full HTTPS support for development (that's a separate concern)
- Any other cookie flag changes

## Decisions

1. **Make `secure` conditional on `NODE_ENV`** — the idiomatic pattern in Node.js apps. `NODE_ENV=production` is the standard signal that the app is behind HTTPS (either directly or via a TLS-terminating proxy).

2. **`secure: process.env.NODE_ENV === 'production'`** — one-line change, no new env vars, no config surface area.

3. **No `sameSite` change** — `SameSite=Strict` is correct and not part of this bug. Changing it would weaken CSRF protection.

## Risks / Trade-offs

- **None for production** — when `NODE_ENV=production`, the behavior is identical to today
- **Development HTTP is slightly less secure** — cookies can be intercepted over the local network. Mitigation: this is only for development, and dev servers bind to localhost by default. Users who want HTTPS in dev can set `NODE_ENV=production` or configure TLS locally.
