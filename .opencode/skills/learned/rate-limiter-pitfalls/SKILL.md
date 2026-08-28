---
name: rate-limiter-pitfalls
description: 'Two rate limiter gotchas: default maxAttempts=1 blocks multi-step flows, and windowMs=0 silently blocks same-ms requests'
origin: consolidated
---

# Rate Limiter Pitfalls

**Consolidated from:** `rate-limiter-maxattempts-default`, `rate-limiter-window-ms-zero-trap`

Covers two common traps when using `createRateLimiter` from `app/utils/rate-limiter.ts`:
1. Default `maxAttempts=1` blocks follow-up requests in multi-step flows
2. `windowMs <= 0` silently blocks same-ms requests

---

## Trap 1: Default `maxAttempts=1` Blocks Multi-Step Flows

### Problem

`createRateLimiter` defaults to `maxAttempts: 1`, allowing only **one** request per window. Multi-step flows — where a client sends an initial request, the user responds, and a follow-up request arrives within the same window — get silently blocked:

```typescript
// Only 1 attempt allowed per 10-second window
const supportAgentRateLimiter = createRateLimiter({ windowMs: 10_000 })
//   maxAttempts defaults to 1 ↑

// Flow:
// POST /admin/support-agent          → attempt() → OK (count=1)
// POST /admin/support-agent/answer   → attempt() → BLOCKED (count >= 1)
//   (arrives within 10s of first request)
```

### Solution

Always set `maxAttempts` explicitly when you expect more than one request per window:

```typescript
const supportAgentRateLimiter = createRateLimiter({
  windowMs: 10_000,
  perKey: true,
  maxAttempts: 5, // explicit: action + answer + toolDecision = ~3
})
```

When choosing a value:
- `perKey: true` (per-IP) or `perUser: true` — prevents one user from starving another
- `maxAttempts`: count the expected request waterfall (e.g. initial + answer + tool decision = at least 3)

---

## Trap 2: `windowMs <= 0` Silently Blocks Same-ms Requests

### Problem

Setting `windowMs=0` (common in dev/test to disable rate limiting) creates a subtle bug: the `entryCount` function checks `Date.now() - entry.firstAt > windowMs`. When `windowMs=0`, this becomes `diff > 0`. If two requests arrive in the same millisecond, `diff = 0` is **not** greater than 0, so the entry is NOT expired and the second request is falsely rate-limited.

### Solution

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

### Detection

- Sequential tests calling the same rate-limited action fail non-deterministically
- "Too many requests" errors in dev/test when `windowMs=0`
- Tests pass interleaved with arbitrary `setTimeout(5)` workarounds

---

## When to Use

- Adding a rate limiter to any endpoint that is part of a multi-step request flow
- Debugging 429 responses that appear only sometimes during normal user workflows
- Setting `windowMs=0` in dev/test to disable rate limiting
- You see "Too many requests" errors but only on the second of two rapid requests
