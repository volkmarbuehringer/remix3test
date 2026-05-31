<!-- Context: project-intelligence/newapp/errors/register-rate-limiting | Priority: medium | Version: 1.0 | Updated: 2026-05-26 -->

# Error: Register Endpoint Lacks Rate Limiting

**Severity**: 🟡 Medium

**Routes**: `/register` (POST)

Login controller has inline per-email rate limiting (5 attempts / 15s, in-memory `Map`). Register endpoint does NOT. The rate limiter at `app/utils/rate-limiter.ts` remains unused.

**Fix**: Apply the same rate limiter pattern from `auth-login-controller.tsx` to the register action.
