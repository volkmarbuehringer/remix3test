# Trap 2: `windowMs <= 0` Silently Blocks Same-ms Requests

**Source:** `rate-limiter-window-ms-zero-trap`

## Problem

Setting `windowMs=0` (common in dev/test to disable rate limiting) creates a subtle bug: the `entryCount` function checks `Date.now() - entry.firstAt > windowMs`. When `windowMs=0`, this becomes `diff > 0`. If two requests arrive in the same millisecond, `diff = 0` is **not** greater than 0, so the entry is NOT expired and the second request is falsely rate-limited.

## Solution

Add an early-return guard that short-circuits all checks when rate limiting is disabled:

```typescript
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  let { windowMs, perUser, perKey, maxAttempts = 1, cleanupInterval } = options

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

## Detection

- Sequential tests calling the same rate-limited action fail non-deterministically
- "Too many requests" errors in dev/test when `windowMs=0`
- Tests pass interleaved with arbitrary `setTimeout(5)` workarounds
