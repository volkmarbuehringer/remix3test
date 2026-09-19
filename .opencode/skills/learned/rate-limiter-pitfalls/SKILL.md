---
name: rate-limiter-pitfalls
description: "Use when a rate limiter blocks unexpectedly — default `maxAttempts=1` breaks multi-step flows and `windowMs=0` silently blocks same-ms requests."
origin: consolidated
---

# Rate Limiter Pitfalls

**Consolidated from:** `rate-limiter-maxattempts-default`, `rate-limiter-window-ms-zero-trap`

Covers two common traps when using `createRateLimiter` from `app/utils/rate-limiter.ts`:
1. Default `maxAttempts=1` blocks follow-up requests in multi-step flows
2. `windowMs <= 0` silently blocks same-ms requests

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A follow-up request in a multi-step flow getting silently blocked (`maxAttempts` default) | `references/maxattempts-default.md` |
| Dev/test disabling the limiter with `windowMs=0` and same-millisecond requests still getting blocked | `references/window-ms-zero-trap.md` |

## Core Rules

- **`createRateLimiter` (from `app/utils/rate-limiter.ts`) defaults to `maxAttempts: 1`** — only **one** request per window, so the follow-up request of a multi-step flow (initial request → user responds → follow-up within the same window) is silently blocked. Always set `maxAttempts` explicitly when you expect more than one request per window.
- **Size `maxAttempts` from the request waterfall**: count the expected requests (e.g. initial + answer + tool decision = at least 3; the worked example uses 5).
- **Set `perKey: true` (per-IP) or `perUser: true`** so one user cannot starve another.
- **`windowMs <= 0` silently blocks same-ms requests**: `entryCount` tests `Date.now() - entry.firstAt > windowMs`; with `windowMs=0` two same-millisecond requests give `diff = 0`, which is **not** `> 0`, so the entry never expires and the second request is falsely rate-limited.
- **Guard the disabled case with an early return**: when `windowMs <= 0`, return a limiter whose `check`/`set`/`attempt`/`state`/`reset` short-circuit (allow everything) before any window logic runs.
- **Detection signals**: sequential tests calling the same rate-limited action fail non-deterministically; "Too many requests" errors appear in dev/test when `windowMs=0`; tests only pass with arbitrary `setTimeout(5)` workarounds.

## When to Use

- Adding a rate limiter to any endpoint that is part of a multi-step request flow
- Debugging 429 responses that appear only sometimes during normal user workflows
- Setting `windowMs=0` in dev/test to disable rate limiting
- You see "Too many requests" errors but only on the second of two rapid requests
