# Cloudflare Tunnel CSRF Origin Fix

## Problem

When the app is accessed through a Cloudflare Tunnel (trycloudflare.com),
POST form submissions fail with `403 Forbidden: invalid CSRF origin`.

**Root cause**: The `csrf()` middleware in `app/middleware/root.ts` does
same-origin validation by comparing `Origin`/`Referer` headers against
`context.url.origin`. Through the tunnel, these don't match:

```
Browser Origin:  https://lexmark-crawford-sarah-proper.trycloudflare.com
context.url:     http://localhost:3000
                 ✗ mismatch → invalid CSRF origin
```

## Scope

Add a `origin` option to the `csrf()` call that accepts tunnel domains,
allowing development/testing via Cloudflare Tunnels without disabling
CSRF protection entirely.

## Approach

Pass a `RegExp` matching trycloudflare.com as the allowed origin:

```ts
csrf({ origin: /\.trycloudflare\.com$/ })
```

This is the narrowest change — CSRF token validation still runs, only
the origin check is relaxed for tunnel domains.
