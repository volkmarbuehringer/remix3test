## Why

The app lacks a Content-Security-Policy header, leaving it vulnerable to XSS attacks. Current security headers middleware only sets `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`. Registration rate limiting exists but uses an inline implementation that bypasses the shared utility, creating maintenance duplication.

## What Changes

- Add `Content-Security-Policy` header with restrictive policy allowing app's own scripts and Remix 3 inline styles
- Add `Strict-Transport-Security` header (production only)
- Add `Permissions-Policy` header disabling unused browser features
- Add `perKey` mode to `createRateLimiter()` utility for string-keyed (email) rate limiting
- Refactor inline register rate limiter to use shared utility
- Refactor inline login rate limiter to use shared utility
- Add security headers middleware tests

## Capabilities

### New Capabilities

- `security-headers`: Complete set of security response headers — CSP, HSTS, Permissions-Policy — with configurable policy and test coverage
- `rate-limiting`: Shared rate limiter utility used consistently across registration and login endpoints

### Modified Capabilities

- (none)

## Impact

- `app/middleware/security-headers.ts`: Grows from 3 to 6 headers; CSP policy must account for Remix 3's inline `css()` style generation
- `app/actions/auth-register-controller.tsx`: Inline rate limiter removed in favor of shared utility
- `app/actions/auth-login-controller.tsx`: Inline rate limiter removed in favor of shared utility
- `app/utils/rate-limiter.ts`: New `perKey` mode for string-keyed limiting
- `app/middleware/security-headers.test.ts`: New test file
- `app/utils/rate-limiter.test.ts`: Extended with perKey tests
