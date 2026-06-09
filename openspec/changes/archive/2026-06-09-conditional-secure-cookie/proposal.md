## Why

Login fails on mobile Chrome 148 over HTTP with "invalid CSRF token". The session cookie at `app/middleware/session.ts` has `secure: true`, which causes Chrome to silently drop the cookie on HTTP connections. Without the session cookie, the server creates a fresh session on every POST, the CSRF token stored in it never matches what the form submitted, and login returns 403.

Desktop works fine because localhost has a browser exception for `Secure` cookies over HTTP.

```
Mobile HTTP flow:
  GET /auth/login
    → server sets Set-Cookie: session=xxx; Secure; …
    → Chrome sees "Secure" on HTTP → **drops cookie**
  POST /auth/login (no cookie)
    → server creates new empty session → new CSRF token "xyz"
    → form sent token "abc" ≠ "xyz" → 403
```

## What Changes

One line in `app/middleware/session.ts:21`:

```ts
// before
secure: true,
// after
secure: process.env.NODE_ENV === 'production',
```

This means:
- **Dev/HTTP** — `NODE_ENV` is not `production` → `secure: false` → cookies work over HTTP
- **Production/HTTPS** — `NODE_ENV` is `production` → `secure: true` → cookies only sent over HTTPS

## Capabilities

No new user-facing capability. Fixes login on mobile devices over HTTP during development.

## Impact

- `app/middleware/session.ts` — one changed line
- No other files touched
