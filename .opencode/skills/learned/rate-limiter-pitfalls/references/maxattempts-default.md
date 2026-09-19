# Trap 1: Default `maxAttempts=1` Blocks Multi-Step Flows

**Source:** `rate-limiter-maxattempts-default`

## Problem

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

## Solution

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
