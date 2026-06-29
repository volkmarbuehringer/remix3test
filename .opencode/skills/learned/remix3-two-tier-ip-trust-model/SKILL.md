---
name: remix3-two-tier-ip-trust-model
description: "Two-tier IP source model for Remix 3: trusted TCP socket IP for auth, header fallback chain for logging"
user-invocable: false
origin: auto-extracted
---

# Remix 3 Two-Tier IP Trust Model

**Extracted:** 2026-06-26
**Context:** Remix 3 apps where client IP is used for both security-critical checks (localhost guards, rate limiting) and audit logging.

## Problem

Using a single `sourceIp()` function with a fallback chain (`X-Forwarded-For` → `X-Real-Ip` → `X-Client-Ip`) for both security and logging is dangerous. `X-Forwarded-For` and `X-Real-Ip` are **spoofable** by the client. A security check like "is this request from localhost?" is bypassed when an attacker sends `X-Forwarded-For: 127.0.0.1`.

## Solution

Use **two tiers** of IP resolution with separate functions:

### Tier 1: Trusted (security-critical)

```ts
// lib/request-ip.ts
export function connectionIp(request: Request): string {
  return request.headers.get('X-Client-Ip') ?? ''
}

export function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}
```

The `X-Client-Ip` header is set by `server.ts` from the actual TCP socket — it **cannot** be spoofed:

```ts
// server.ts
const handler = createRequestListener(
  async (request, client) => {
    if (client?.address) {
      request.headers.set('X-Client-Ip', client.address)
    }
    return await router.fetch(request)
  },
  { trustProxy: true },
)
```

Use `connectionIp()` for security decisions:
- Localhost guard on `/callback` endpoints
- IP-based rate limiting on login
- Admin IP allowlists

### Tier 2: Untrusted (informational)

```ts
// lib/request-ip.ts
export function sourceIp(request: Request): string {
  return (
    request.headers.get('X-Client-Ip') ??
    request.headers.get('Cf-Connecting-Ip') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    request.headers.get('X-Real-Ip') ??
    ''
  )
}
```

Use `sourceIp()` for non-security purposes:
- Storing `source_ip` in database audit columns
- Logging client addresses
- Analytics and metrics

### Why Not `X-Forwarded-For`?

| Source | Spoofable | Use Case |
|--------|-----------|----------|
| `client.address` (TCP socket) | No | Security decisions |
| `X-Client-Ip` (set by server.ts) | No | Security decisions |
| `X-Forwarded-For` | Yes | Audit logging only |
| `X-Real-Ip` | Yes | Audit logging only |

## When to Use

- Adding a localhost-restricted endpoint (callback, admin)
- Implementing IP-based rate limiting on authentication routes
- Storing client IP for audit logs alongside a security IP check
- Any Remix 3 app where client IP is trusted for authorization decisions
