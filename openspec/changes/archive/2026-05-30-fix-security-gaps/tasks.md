## 1. Shared Rate Limiter — `perKey` Mode

- [x] 1.1 Add `perKey` option to `RateLimiterOptions` interface in `app/utils/rate-limiter.ts`
- [x] 1.2 Update internal `getKey()` to accept `string | number | undefined` and return the string directly when `perKey` is true
- [x] 1.3 Update `check()`, `set()`, `attempt()`, `reset()` signatures to accept `key?: number | string`
- [x] 1.4 Add validation: throw if both `perUser` and `perKey` are set
- [x] 1.5 Extend `app/utils/rate-limiter.test.ts` with perKey tests: check, set, attempt, reset cycle; window expiry; cleanup interval; mutual exclusion with perUser; independence between limiters

## 2. Migrate Register Rate Limiter to Shared Utility

- [x] 2.1 In `app/actions/auth-register-controller.tsx`, remove lines 21–62 (inline `registerAttempts` Map, helper functions, interval cleanup)
- [x] 2.2 Import `createRateLimiter` and create `registerLimiter = createRateLimiter({ windowMs: 15000, perKey: true })`
- [x] 2.3 Replace `isRegisterRateLimited(email)` with `registerLimiter.check(email)`
- [x] 2.4 Replace `recordRegisterAttempt(email)` with `registerLimiter.set(email)`
- [x] 2.5 Replace inline check+set with `registerLimiter.attempt(email)`
- [x] 2.6 Replace `clearRegisterRateLimit(email)` with `registerLimiter.reset(email)`
- [x] 2.7 Update `app/actions/auth-register-controller.test.ts` if behavior changed

## 3. Migrate Login Rate Limiter to Shared Utility

- [x] 3.1 Read the current inline login rate limiter in `app/actions/auth-login-controller.tsx`
- [x] 3.2 Replace inline `loginAttempts` Map with `loginLimiter = createRateLimiter({ windowMs: 15000, perKey: true })`
- [x] 3.3 Replace existing check/set/reset calls with `loginLimiter.check()`, `loginLimiter.set()`, `loginLimiter.reset()`
- [x] 3.4 Update `app/actions/auth-login-controller.test.ts` if behavior changed

## 4. Security Headers — CSP + HSTS + Permissions-Policy

- [x] 4.1 In `app/middleware/security-headers.ts`, define a static CSP policy string at module scope
- [x] 4.2 Add `Strict-Transport-Security` header production-only
- [x] 4.3 Add `Permissions-Policy` header
- [x] 4.4 Ensure all new headers follow the existing `!headers.has(name)` guard pattern
- [x] 4.5 Verify the middleware still applies all 6 headers in order without overwriting upstream headers

## 5. Security Headers Tests

- [x] 5.1 Create `app/middleware/security-headers.test.ts`
- [x] 5.2 Test all 6 headers present on a sample response
- [x] 5.3 Test CSP directives
- [x] 5.4 Test HSTS only present when production
- [x] 5.5 Test pre-existing headers are not overwritten
- [x] 5.6 Test edge cases: null body, empty response

## 6. Validation

- [x] 6.1 Run `npm run typecheck` — fix any type errors
- [x] 6.2 Run `npm test` — fix any test failures
- [x] 6.3 Run `npm run lint` — fix any lint issues
