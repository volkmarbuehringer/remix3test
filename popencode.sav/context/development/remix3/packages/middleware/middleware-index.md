<!-- Context: development/remix3/packages/middleware | Priority: medium | Version: 1.0 | Updated: 2026-04-25 -->

# Middleware Quick Reference

Middleware packages add functionality to fetch-router at global or route level.

| Package | Purpose | Key Function |
|---------|---------|--------------|
| `auth-middleware` | Auth resolution | `auth()` |
| `session-middleware` | Session management | `session(cookie, storage)` |
| `form-data-middleware` | Form parsing | `formData()` |
| `cors-middleware` | CORS headers | `cors()` |
| `csrf-middleware` | CSRF protection | `csrf()` |
| `compression-middleware` | Gzip/Brotli | `compress()` |
| `static-middleware` | Static file serving | `staticFiles(path)` |
| `logger-middleware` | Request logging | `logger()` |
| `method-override-middleware` | HTTP method override | `methodOverride()` |

## Usage Pattern

```ts
let router = createRouter({
  middleware: [
    // Global middleware runs on all requests
    staticFiles('./public'),
    cors({ origin: '*' }),
    compress(),
    session(cookie, storage),
    formData(),
  ],
})
```

## Reference

Individual READMEs in `/home/lucky/remix/packages/*-middleware/README.md`