# Rate Limiting

## Overview

A shared, configurable rate limiter utility that protects auth endpoints (login, register) against brute-force and account-creation flood attacks. The utility must support both numeric (user ID) and string (email) keying strategies so that login and registration rate limiting use the same implementation instead of inline duplicates.

## Scope

- `app/utils/rate-limiter.ts` — shared `createRateLimiter()` factory
- `app/actions/auth-login-controller.tsx` — login rate limiting
- `app/actions/auth-register-controller.tsx` — registration rate limiting

## Requirements

### R1 — Factory function

Export `createRateLimiter(options: RateLimiterOptions): RateLimiter`.

```ts
interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number
  /** Track per-user by numeric ID */
  perUser?: boolean
  /** Track per-key by string (email, IP, etc.) */
  perKey?: boolean
  /** Cleanup interval for map entries (default: windowMs * 100) */
  cleanupInterval?: number
}

interface RateLimiter {
  /** Check if the given key is rate-limited. Returns { allowed, retryAfter? }. */
  check(key?: number | string): { allowed: boolean; retryAfter?: number }
  /** Record an attempt for the given key. */
  set(key?: number | string): void
  /** Atomically check and set. Returns false if rate-limited. */
  attempt(key?: number | string): boolean
  /** Reset rate limit counter for the given key. */
  reset(key?: number | string): void
}
```

### R2 — Keying modes

Exactly one of `perUser` or `perKey` must be set. If neither is set, the limiter is global (single key).

| Mode     | `options`           | Key type            | Example                      |
| -------- | ------------------- | ------------------- | ---------------------------- |
| Global   | `{}`                | (internal sentinel) | Global IP-based (future use) |
| Per-user | `{ perUser: true }` | `number` (userId)   | Login rate limiter           |
| Per-key  | `{ perKey: true }`  | `string` (email)    | Register rate limiter        |

If both `perUser` and `perKey` are set, throw on construction.

### R3 — Window behavior

- First attempt within a window starts the window timer
- Subsequent attempts within `windowMs` increment the counter
- When the counter exceeds 1 (single-attempt window), `check()` returns `{ allowed: false, retryAfter }`
- After `windowMs` elapses since the first attempt, the entry is auto-cleared on next access
- Cleanup interval periodically purges stale entries (default: `windowMs * 100`)

### R4 — Cleanup

- If `perUser` or `perKey` is set, start a cleanup interval that runs every `cleanupInterval`
- The interval timer must use `.unref()` so it does not prevent process exit
- Cleanup removes entries whose `firstAt < (Date.now() - windowMs)`

### R5 — Login endpoint behavior

- Key: `userId` (numeric, from database lookup after email is found)
- Window: 1 second (effectively one attempt per second per user)
- On failed login: call `limiter.set(userId)`
- On successful login: call `limiter.reset(userId)` to clear history
- This is the same behavior as the current inline implementation

### R6 — Register endpoint behavior

- Key: normalized email string (lowercase + trim)
- Window: 15 seconds
- Max attempts: 5
- On register attempt: call `limiter.attempt(email)` — returns false if rate-limited
- On successful registration: call `limiter.reset(email)` to clear history
- This preserves the same behavior as the current inline implementation

### R7 — No shared state between modes

Global, per-user, and per-key limiters must have independent internal maps. Creating a new limiter must not affect other limiters.

## Exceptions

- Rate limiting is production-only when governed by an env var (matching current login pattern)
- In tests, rate limiters should be constructed with short windows or bypassed

## Test Requirements

- File: `app/utils/rate-limiter.test.ts` (extend existing)
- Must test `perKey` mode: check, set, attempt, reset cycle
- Must test window expiry (entry auto-clears after windowMs)
- Must test cleanup interval purges stale entries
- Must test error when both `perUser` and `perKey` are set
- Must test that perKey and perUser limiters are independent
