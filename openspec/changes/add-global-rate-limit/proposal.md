## Why

Rate limiting is scattered across 10+ controllers as action-specific semantic limits — brute-force protection on login (5/15s per email), throttles on chat (1/2s per user), per-appointment CRUD limits, etc. But there is **no network-level defense** between `compression()` and `formData()`:

```
req → compression() → formData() → session() → auth() → db() → controller
                        ↑                            ↑
                   Every request parsed         Every request hits DB/LLM
                   (even floods)                (even floods)
```

A single IP can send unlimited requests, exhausting DB connections, LLM API quota, or worker threads before any action-level limit fires. This gap affects all 30+ controllers, including the many that have NO rate limiting at all.

## What Changes

- Create `app/middleware/global-rate-limit.ts` — a `globalRateLimit()` middleware factory using the existing `createRateLimiter` utility
- Insert it into the global middleware stack in `app/middleware/root.ts` right after `compression()` — a fast exit before body parsing or session loading
- **Skips `/assets/*`** — compiled browser modules fetched in bulk per page load (20-30 per page). Including them would conflate page-visit limits with asset-bundle requests
- **Applies to everything else** — all HTML pages, form submissions, API calls, fragments, SSE endpoints — counted against a single per-IP bucket
- Default limit **500 requests/min per IP**, configurable via `GLOBAL_RATE_LIMIT_MAX` env var
- Returns **429 text/plain** with a `Retry-After` header (no rendering overhead)
- Adds **`RateLimit-*`** headers on every response for client transparency (Limit, Remaining, Reset)

## Capabilities

No new user-facing capability. This is security infrastructure that cuts across all capabilities by adding a network-level protection layer.

## Impact

- `app/middleware/global-rate-limit.ts` — new file (~40 lines)
- `app/middleware/root.ts` — add one import and one line to the middleware chain
- No changes to controllers, routes, or existing rate limiters
