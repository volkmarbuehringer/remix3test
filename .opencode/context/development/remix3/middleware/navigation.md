<!-- Context: development/remix3/middleware | Priority: high | Version: 1.1 | Updated: 2026-05-07 -->

# Middleware

**Core Idea**: Request lifecycle middleware — compression, sessions, auth, form data, CORS, CSRF, async context, method override, static files, and custom middleware composition.

> **Type update**: `Middleware` type lost its `_method` generic parameter. See `../guides/action-type-patterns.md` for details.

## Quick Routes

| Task | File |
|------|------|
| Middleware ordering | `guides/middleware-composition.md` |
| Async context | `concepts/async-context-middleware.md` |
| Context get() pattern | `concepts/request-context-get-pattern.md` |
| Compression | `concepts/compression-middleware.md` |
| CORS | `concepts/cors-middleware.md` |
| CSRF | `concepts/csrf-middleware.md` |
| Content Security | `concepts/cop-middleware.md` |
| Method override | `concepts/method-override-middleware.md` |
| Static files | `concepts/static-middleware.md` |
| Form data | `concepts/form-data-middleware.md` |
| Multipart parser | `concepts/multipart-parser.md` |
| Fetch proxy | `concepts/fetch-proxy.md` |
| API reference | `lookup/middleware-api-reference.md` |
