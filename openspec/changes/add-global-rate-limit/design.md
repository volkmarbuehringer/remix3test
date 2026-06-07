## Context

The app has 30+ controllers serving auth, admin, appointment, chat, and other features. Ten controllers already use action-level rate limiting (`app/utils/rate-limiter.ts`), but the middleware stack has no early-exit defense:

```
Current stack:
  logger → securityHeaders → compression
  → formData → methodOverride → session → csrf
  → asyncContext → database → auth → mailer
  → assetEntry → render → json
                      ↑
              No rate limit anywhere in here
```

The global middleware is the natural place for a first-line throughput gate. The existing `createRateLimiter()` utility provides the primitives — per-key (IP) counting with automatic window decay and cleanup.

8. **Server-side logging on every 429** — each rate-limit rejection is logged with the client IP, path, current count vs limit, and Retry-After value. This surfaces abuse patterns in production logs without needing separate monitoring.

## Goals / Non-Goals

**Goals:**
- Block flood-level traffic from a single IP before it reaches formData parsing, session loading, or database queries
- Cover all routes uniformly — including the 20+ controllers with no rate limiting today
- Reuse the existing `createRateLimiter()` utility — no new storage or infrastructure
- Make the limit configurable via a single environment variable
- Include standard `RateLimit-*` headers for client visibility

**Non-Goals:**
- Replacing action-level semantic rate limits (login brute-force protection, chat throttles, appointment CRUD limits — these stay in controllers)
- Per-user, per-route, or per-method differentiation (single per-IP bucket for all non-asset traffic)
- Distributed/cross-process counting (Redis — not needed for first version)
- Dynamic rate limit adjustment or auto-tuning

## Decisions

1. **Reuse `createRateLimiter`** — it already handles per-key counting, window decay, and cleanup timer cleanup. No new state machinery needed.

2. **Per-IP only** — no per-user or per-route distinction in this layer. The IP is the simplest axis for flood detection. User-level limits belong in controllers where auth context exists.

3. **Skip `/assets/*`** — the asset route serves compiled browser modules. A single page load triggers 20-30 asset fetches in parallel. Counting them would make the limit about asset bundle size rather than traffic volume. The path check is a simple `url.pathname.startsWith('/assets/')`.

4. **Default 500 requests/min** — generous enough that no real user hits it, tight enough to catch obvious floods. Environment-configurable for deployment tuning. At 500/min (~8/sec), a human user navigating, submitting forms, and loading assets is well under the ceiling; a script hammering endpoints gets blocked.

5. **Early stack position (after `compression()`)** — blocked requests never parse formData, load sessions, touch the database, or call LLM APIs. Only the IP is looked up in an in-memory Map — O(1), cleanupped by the existing interval timer.

6. **Plain text 429 response** — no HTML rendering, no layout. The middleware runs before the `render()` and `json()` middleware, so those aren't available anyway. A minimal text response plus `Retry-After` header is the right tradeoff.

7. **RateLimit-* headers on all responses** — the draft standard (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) costs almost nothing to add (one in-memory lookup per response) and lets clients, CDNs, and operators observe their limit status.

## Risks / Trade-offs

- **Behind-NAT users share an IP** — 500 requests/min is generous enough that a few users behind the same NAT shouldn't collide. If a school or office hits the limit, the admin can raise it via env var.
- **Trusted proxy headers** — the app may run behind a reverse proxy. The middleware should check `X-Forwarded-For` first, then `X-Real-IP`, then fall back to `request.ip` (set by the node-fetch-server). This matches how most proxies pass client IPs.
- **Memory** — each unique IP creates one Map entry (a few dozen bytes). Under normal traffic this is negligible. The cleanup timer in `createRateLimiter` periodically evicts stale entries.
- **No bypass for authenticated users** — this layer runs before auth middleware, so it can't exempt known users. That's intentional: flood protection at the network level should treat all IPs equally.
