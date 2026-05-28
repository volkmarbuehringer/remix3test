<!-- Context: project-intelligence/newapp/concepts/rate-limiting | Priority: medium | Version: 1.0 | Updated: 2026-05-25 -->

# Concept: In-Memory Rate Limiting Pattern

**Core Idea**: Per-user in-memory rate limiters for appointment mutations using a `Map<userId, timestamp>` with configurable window. Disabled in non-production by setting `windowMs: 0`.

---

## Rate Limiter Utility

`app/utils/rate-limiter.ts` exports a factory `createRateLimiter(options)`:

| Option | Default | Purpose |
|--------|---------|---------|
| `windowMs` | required | Minimum ms between allowed operations |
| `perUser` | `false` | Track per-user (by ID) vs single global counter |
| `cleanupInterval` | `windowMs * 100` | How often to sweep stale entries |

### API

| Method | Signature | Returns | Side Effect |
|--------|-----------|---------|-------------|
| `check` | `(userId?) => { allowed: boolean, retryAfter?: number }` | Whether operation is allowed | None |
| `set` | `(userId?) => void` | `void` | Records current timestamp |
| `attempt` | `(userId?) => boolean` | Whether allowed | Atomically check + set |
| `reset` | `(userId?) => void` | `void` | Clears user's timestamp |

## Appointment Controller Usage

Three separate per-user limiters in `app/actions/appointment-controller.tsx`:

```tsx
// lines 30-35
const RATE_LIMIT_MS = Number(process.env.APPOINTMENT_RATE_LIMIT_MS) ||
  (process.env.NODE_ENV === 'production' ? 1000 : 0)

const createLimiter  = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const updateLimiter  = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const deleteLimiter  = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
```

Used in each action before processing:

```tsx
// create action (line 162):
if (!createLimiter.attempt(userId)) {
  return Response.json(
    { error: 'Too many requests. Please wait before creating another appointment.' },
    { status: 429 },
  )
}
```

## `windowMs: 0` Behavior

When `windowMs = 0`, `check()` always returns `{ allowed: true }` because:
```
now - lastTime < windowMs  →  now - lastTime < 0  →  always false
```

This effectively disables rate limiting in development/test without code changes.

### Environment Configuration

| Environment | `NODE_ENV` | `APPOINTMENT_RATE_LIMIT_MS` | Effective `windowMs` |
|-------------|-----------|------------------------------|---------------------|
| Production | `production` | unset | 1000 (1 req/s) |
| Production (custom) | `production` | `2000` | 2000 |
| Development | `development` | unset | 0 (disabled) |
| Test | `test` | unset | 0 (disabled) |

## Stale Entry Cleanup

Per-user limiters create a `setInterval` that sweeps entries older than `cleanupInterval` (default: `windowMs * 100`). The timer is unref'd so it doesn't block process exit:

```tsx
// rate-limiter.ts lines 28-41
let cleanupTimer = setInterval(() => { /* sweep */ }, cleanupInterval)
if (cleanupTimer.unref) cleanupTimer.unref()
```

**Important**: When `windowMs = 0`, `cleanupInterval = 0`, so `setInterval(fn, 0)` fires on every event loop tick. In practice this is fine because the Map is empty (no stamps are recorded when `windowMs = 0`) and the timer is unref'd. But this is a pathological case to be aware of if enabling per-user limiters with zero window.

## Limitations

- In-memory only — resets on server restart
- Not distributed — doesn't work across multiple server instances
- Per-user Map can grow unbounded if users with stale entries are never cleaned (mitigated by cleanup interval)

## 📂 Codebase References

| File | Lines | Purpose |
|------|-------|---------|
| `app/utils/rate-limiter.ts` | 1-87 | `createRateLimiter()` factory + types |
| `app/utils/rate-limiter.test.ts` | 1-* | Unit tests |
| `app/actions/appointment-controller.tsx` | 25-35 | Rate limiter setup for appointments |
| `app/actions/appointment-controller.tsx` | 162-164 | `createLimiter.attempt()` in create action |
| `app/actions/appointment-controller.tsx` | 256-258 | `updateLimiter.attempt()` in update action |
| `app/actions/appointment-controller.tsx` | 322-324 | `deleteLimiter.attempt()` in destroy action |
| `app/lib/messages-sse.ts` | 1 | SSE channel also imports rate limiter |
| `app/actions/chat-controller.tsx` | 16 | Chat controller also imports rate limiter |

## Related

- [Appointment Calendar Architecture](./appointment-calendar.md) — Controller actions overview
- [Known Issues](../lookup/known-issues.md) — Register endpoint missing rate limiting
