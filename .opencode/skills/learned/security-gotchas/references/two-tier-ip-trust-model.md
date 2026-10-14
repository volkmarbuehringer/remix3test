# Remix 3 Two-Tier IP Trust Model

**Source:** `remix3-two-tier-ip-trust-model`

**Extracted:** 2026-06-26
**Revalidated:** 2026-10-14 against `remix` 3.0.0 (build 2c9e033, source e6a63ea; `@remix-run/node-fetch-server` 1.0.0, `src/lib/request-listener.ts:458-471`).
**Context:** Remix 3 apps where client IP is used for both security-critical checks (localhost guards, rate limiting) and audit logging.

## Problem

Using a single `sourceIp()` function with a fallback chain (`X-Forwarded-For` → `X-Real-Ip` → `X-Client-Ip`) for both security and logging is dangerous. `X-Forwarded-For` and `X-Real-Ip` are **spoofable** by the client. A security check like "is this request from localhost?" is bypassed when an attacker sends `X-Forwarded-For: 127.0.0.1`.

## Solution

Use **two tiers** of IP resolution. The working implementation is `app/utils/request-ip.ts`:

- `connectionIp(request)` — Tier 1 (trusted): reads `X-Client-Ip`, the header stamped by `app/utils/server-handler.ts:79` from the TCP-socket address that `server.ts` passes in.
- `isLocalhost(ip)` — matches `127.0.0.1`, `::1`, `::ffff:127.0.0.1`.
- `sourceIp(request)` — Tier 2 (untrusted): fallback chain `X-Client-Ip` → `Cf-Connecting-Ip` → `X-Forwarded-For` → `X-Real-Ip`, for audit logging only.

### Tier 1: Trusted (security-critical)

Use `connectionIp()` for security decisions:

- Localhost guard on `/callback` endpoints
- IP-based rate limiting on login
- Admin IP allowlists

### Tier 2: Untrusted (informational)

Use `sourceIp()` for non-security purposes:

- Storing `source_ip` in database audit columns
- Logging client addresses
- Analytics and metrics

### Why Not `X-Forwarded-For`?

| Source                                            | Spoofable              | Use Case           |
| ------------------------------------------------- | ---------------------- | ------------------ |
| `client.address` (TCP socket, `trustProxy: false`) | No                     | Security decisions |
| `X-Client-Ip` (`trustProxy: false`, always `set`)  | No                     | Security decisions |
| `client.address` (`trustProxy: true`)              | Yes — from forwarded headers | Never for auth |
| `X-Forwarded-For` / `X-Real-Ip`                   | Yes                    | Audit logging only |

## CRITICAL: `trustProxy` Determines Whether `X-Client-Ip` Is Spoofable

The claim that `X-Client-Ip` "cannot be spoofed" is **only true when
`trustProxy: false`**. When `createRequestListener` is passed
`{ trustProxy: true }`, the framework derives `client.address` from the
client-controlled `X-Forwarded-For` header (falling back to the socket IP
only when absent). That spoofed value is then stamped into `X-Client-Ip`,
which silently re-enables every attack the two-tier model was meant to stop:

```ts
// VULNERABLE — client.address is taken from spoofable X-Forwarded-For
const handler = createRequestListener(handler, { trustProxy: true })
```

### Correct server.ts / server handler

See `server.ts` + `app/utils/server-handler.ts:79` — `server.ts` receives the
TCP-socket address as `client.address` and hands it to `createServerHandler`,
which stamps `X-Client-Ip` from that value
(`request.headers.set('X-Client-Ip', clientIp)`, always `set()` so a
client-supplied value is overwritten). `server.ts` passes
`{ trustProxy: isHmr }` (true only under `REMIX_NODE_HMR=1`, i.e. dev/HMR), so
production stays socket-only.

`trustProxy: true` is only safe when a **trusted reverse proxy strips and
rewrites** `X-Forwarded-For` (e.g. nginx `proxy_set_header`, cloudflare).
With no such proxy, keep it `false` (default) and always `set()` the header
so a client can't smuggle its own `X-Client-Ip`.

### Rate limiters must use the socket tier

Key IP-based rate limits on `connectionIp()` (socket tier), not `sourceIp()`
(header tier). Admin-only agent endpoints (`requireAdmin()`) should skip IP
entirely and key on `auth.identity.id` with `perUser: true`.

### Detection
- Login or agent endpoints rate-limited from rotating IPs despite one client
- `/callback` localhost guard passes for a remote attacker sending
  `X-Forwarded-For: 127.0.0.1`

## When to Use

- Adding a localhost-restricted endpoint (callback, admin)
- Implementing IP-based rate limiting on authentication routes
- Storing client IP for audit logs alongside a security IP check
- Any Remix 3 app where client IP is trusted for authorization decisions
