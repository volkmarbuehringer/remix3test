# Security Headers

## Overview

All HTTP responses from the Remix 3 server must carry a defined set of security headers that protect against common web attacks (XSS, clickjacking, MIME sniffing, protocol downgrade) and disable unused browser features.

## Scope

Every response produced by any route — HTML pages, JSON API responses, SSE event streams, static assets.

## Requirements

### R1 — Baseline headers (always present)

| Header                   | Value                             | Purpose                        |
| ------------------------ | --------------------------------- | ------------------------------ |
| `X-Content-Type-Options` | `nosniff`                         | Prevent MIME type sniffing     |
| `X-Frame-Options`        | `DENY`                            | Prevent clickjacking in frames |
| `Referrer-Policy`        | `strict-origin-when-cross-origin` | Control referrer leakage       |

These three headers are already implemented. They must continue to be set on every response.

### R2 — Content-Security-Policy

A `Content-Security-Policy` header must be set on every response with the following directives:

| Directive         | Value                                                  | Rationale                                                  |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| `default-src`     | `'self'`                                               | Restrict all resource loading to same origin by default    |
| `script-src`      | `'self'`                                               | Only scripts from same origin (Remix bundles are external) |
| `style-src`       | `'self' 'unsafe-inline'`                               | Remix 3 `css()` mixins generate inline `<style>` elements  |
| `connect-src`     | `'self' ws://localhost:44100 wss: https://opencode.ai` | SSE connections + AI provider API                          |
| `frame-ancestors` | `'none'`                                               | Matches existing X-Frame-Options DENY                      |
| `form-action`     | `'self'`                                               | Only allow form submissions to same origin                 |
| `img-src`         | `'self' data:`                                         | Allow inline data URIs for simple images                   |
| `base-uri`        | `'self'`                                               | Prevent `<base>` injection                                 |

The policy string must be constructed once at module initialization and reused across requests (no per-request string building).

### R3 — Strict-Transport-Security

| Condition                                | Value                                 |
| ---------------------------------------- | ------------------------------------- |
| Production (`NODE_ENV === 'production'`) | `max-age=31536000; includeSubDomains` |
| Development                              | Not set (allows HTTP local dev)       |

### R4 — Permissions-Policy

| Directive     | Value |
| ------------- | ----- |
| `camera`      | `()`  |
| `microphone`  | `()`  |
| `geolocation` | `()`  |
| `payment`     | `()`  |
| `usb`         | `()`  |

### R5 — Existing header preservation

Headers already set by routes or upstream middleware must not be overwritten. Each security header middleware must check `!headers.has(name)` before setting, matching the existing pattern.

### R6 — No duplication

If calling `securityHeaders()` multiple times in a middleware chain, headers must not be set twice. Use the `has()` guard pattern.

## Exceptions

None. Every response must carry the full set of headers. The middleware is global in the router stack at position 2 (between `logger` and `compression`).

## Test Requirements

- Unit test file: `app/middleware/security-headers.test.ts`
- Must test all 6 headers present on a sample response
- Must test CSP directive content (script-src, style-src, connect-src values)
- Must test HSTS only present in production (mock `NODE_ENV`)
- Must test that pre-existing headers are not overwritten
- Must test that the middleware does not throw on edge cases (null body, empty response)
