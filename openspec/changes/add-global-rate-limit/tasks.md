## 1. Create `app/middleware/global-rate-limit.ts`

- [x] 1.1 Import `createRateLimiter` from `../utils/rate-limiter.ts`
- [x] 1.2 Define a `globalRateLimit(options?)` factory function with:
  - `options.maxPerWindow` (default: 500) — max requests per window
  - `options.windowMs` (default: 60_000) — window in milliseconds
- [x] 1.3 Inside the middleware, derive the client IP:
  - Check `x-forwarded-for` header (first IP in comma-separated list)
  - Fall back to `x-real-ip` header
  - Fall back to `'unknown'`
- [x] 1.4 Skip counting if `context.url.pathname.startsWith('/assets/')` — call `next()` without checking the limiter
- [x] 1.5 Call `limiter.attempt(ip)` — if it returns `false`, log the event with `console.warn` including IP, path, and retry-after, then return a `429` text/plain response with a `Retry-After` header
- [x] 1.6 If allowed, call `next()` and on the returned `Response`, append `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers computed from the limiter's current state
- [x] 1.7 Export `globalRateLimit` as a named export

## 2. Wire into middleware stack

- [x] 2.1 Import `globalRateLimit` from `./global-rate-limit.ts` in `app/middleware/root.ts`
- [x] 2.2 Insert `globalRateLimit()` into the `createMiddleware()` chain immediately after `compression()` — before `formData()` so blocked requests skip body parsing
- [x] 2.3 Read `GLOBAL_RATE_LIMIT_MAX` env var and pass it as `maxPerWindow` if set: `globalRateLimit({ maxPerWindow: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || undefined })`

## 3. Environment config

- [x] 3.1 Add `# GLOBAL_RATE_LIMIT_MAX=500` to `.env.example` with a comment explaining the per-IP per-minute limit

## 4. Verify

- [x] 4.1 Run `npm run typecheck` to verify no type errors — clean (newerapp/ errors are pre-existing)
- [x] 4.2 Run `npm test` to confirm existing tests still pass — 746/746 pass, 0 failures
- [ ] 4.3 Optional: start the dev server and verify a rapid sequence of requests from the same IP eventually returns 429 (e.g., `for i in $(seq 1 600); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:44100/; done | sort | uniq -c`)
