---
name: rate-limiter-maxattempts-default
description: "Default maxAttempts=1 in createRateLimiter blocks follow-up requests in multi-step flows"
origin: auto-extracted
---

# Rate Limiter: Default `maxAttempts=1` Blocks Follow-up Requests

**Extracted:** 2026-07-13
**Context:** Route-agent had a POST /route-agent (start agent) followed by POST /route-agent/answer (resume with user answer). The rate limiter's default `maxAttempts=1` blocked the answer request because the initial action consumed the single allowed slot.

## Problem

`createRateLimiter` from `app/utils/rate-limiter.ts` defaults to `maxAttempts: 1`, allowing only **one** request per window. Multi-step flows — where a client sends an initial request, the user responds, and a follow-up request arrives within the same window — get silently blocked:

```typescript
// Only 1 attempt allowed per 10-second window
const routeAgentRateLimiter = createRateLimiter({ windowMs: 10_000, perUser: false })
//   maxAttempts defaults to 1 ↑

// Flow:
// POST /route-agent          → attempt() → OK (count=1, firstAt=T)
// POST /route-agent/answer   → attempt() → BLOCKED (count >= 1)
//   (arrives within 10s of T)
```

The blocked request returns 429 with no visible error in most cases — the client catches the non-ok response and shows "Error: Too many requests" in a status bar that users easily miss.

## Solution

Always set `maxAttempts` explicitly when you expect more than one request per window:

```typescript
// Good — allows up to 5 requests per 10s window
const routeAgentRateLimiter = createRateLimiter({
  windowMs: 10_000,
  perKey: true,         // track per-IP instead of global
  maxAttempts: 5,       // explicit: action + answer + toolDecision = ~3
})
```

When choosing a value:
- `perKey: true` (per-IP) or `perUser: true` instead of the default global tracking — prevents one user from starving another
- `maxAttempts`: count the expected request waterfall (e.g. initial POST + answer POST + tool decision = at least 3)
- If requests are truly independent (not a waterfall), count expected usage per window

## When to Use

- Adding a rate limiter to any endpoint that is part of a multi-step request flow (action → response → follow-up action)
- Debugging 429 responses that appear only sometimes during normal user workflows
- You see "Too many requests" errors in the bar/log but only on the second of two rapid requests
- The rate limiter was created without an explicit `maxAttempts` option
