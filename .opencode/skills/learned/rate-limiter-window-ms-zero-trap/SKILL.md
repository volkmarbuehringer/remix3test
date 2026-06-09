---
name: rate-limiter-window-ms-zero-trap
description: "Rate limiter with windowMs=0 silently blocks same-ms requests"
origin: auto-extracted
---

# Rate Limiter: windowMs <= 0 Silently Blocks Same-ms Requests

**Extracted:** 2026-06-09
**Context:** Rate limiter implementations that check `now - entry.firstAt > windowMs` to expire old entries.

## Problem

Setting `windowMs=0` (common in dev/test to disable rate limiting) creates a subtle bug: the `entryCount` function checks `Date.now() - entry.firstAt > windowMs`. When `windowMs=0`, this becomes `diff > 0`. If two requests arrive in the same millisecond, `diff = 0` is **not** greater than 0, so the entry is NOT expired and the second request is falsely rate-limited.

```typescript
// Bug: with windowMs=0, same-ms requests are always blocked
entryCount(key) {
  let entry = entries.get(key)
  if (!entry) return 0
  if (Date.now() - entry.firstAt > windowMs) {  // 0 > 0 is false for same-ms
    entries.delete(key)
    return 0
  }
  return entry.attempts  // returns 1, triggering false rate limit
}
```

This manifests as:
- Sequential tests calling the same rate-limited action fail non-deterministically
- Production with `windowMs=0` (if used for debugging) blocks rapid requests
- Tests pass interleaved with arbitrary `setTimeout(5)` workarounds

## Solution

Add an early-return guard that short-circuits all checks when rate limiting is disabled:

```typescript
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  let { windowMs, perUser, perKey, maxAttempts = 1, cleanupInterval } = options

  // windowMs <= 0 means rate limiting is disabled
  if (windowMs <= 0) {
    return {
      check(): { allowed: boolean } { return { allowed: true } },
      set(): void {},
      attempt(): boolean { return true },
      state() { return { count: 0, remaining: maxAttempts, reset: 0 } },
      reset(): void {},
    }
  }

  // ... normal implementation ...
}
```

This makes the intent explicit: `windowMs <= 0` means "unlimited."

## When to Use

- Your rate limiter has an `entryCount`-style expiration check
- You set `windowMs=0` in dev/test to disable rate limiting
- You see non-deterministic "rate limited" errors in tests with no obvious cause
- You're adding a rate limiter to any JS/TS project
