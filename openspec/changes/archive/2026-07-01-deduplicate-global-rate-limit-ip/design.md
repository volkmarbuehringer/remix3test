## Context

`app/middleware/global-rate-limit.ts` maintains its own copy of `sourceIp()`'s fallback chain plus a `trustProxy` gate that controls whether the full chain or just `X-Client-Ip` is used. The shared `app/lib/request-ip.ts` `sourceIp()` already implements the full fallback chain unconditionally. Since rate-limiting is a mitigation measure (not an authorization gate), using the full chain is always appropriate — there is no security reason to restrict to `X-Client-Ip` only.

## Goals / Non-Goals

**Goals:**

- Replace inline fallback chain with `sourceIp(context.request) || 'unknown'`
- Remove the `trustProxy` option from the middleware
- Remove unused option plumbing

**Non-Goals:**

- No changes to `sourceIp()` or `connectionIp()` in `app/lib/request-ip.ts`
- No behavioral changes in production
- No rate-limiting logic changes

## Decisions

1. **Drop `trustProxy` entirely** — The middleware's `trustProxy` defaulted to `NODE_ENV === 'production'`, but `server.ts` always sets `trustProxy: true` for the listener. More importantly, rate-limiting is never authorization — there's no security downgrade in using the full fallback chain. Simplifies to unconditional `sourceIp()`.

2. **Use `sourceIp()` not `connectionIp()`** — Rate-limiting should see the best-available client identifier, which `sourceIp()` provides via its multi-header fallback. `connectionIp()` is reserved for auth decisions where the TCP socket is the only trusted source.

## Risks / Trade-offs

- **[Low] Middleware options API change** — The `trustProxy` option on `globalRateLimit()` is technically a public API. No other code passes it, so removal is safe.
- **[None] Behavioral regression** — `sourceIp()` reads `X-Client-Ip` first, same as the existing `trustProxy: true` path. The middleware's `trustProxy: false` path (dev/test) was a subset of the full chain, but using the full chain in dev is harmless and may even be more useful (e.g., local proxy setups).
