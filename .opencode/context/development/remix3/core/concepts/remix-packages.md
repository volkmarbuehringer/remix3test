<!-- Context: development/remix3/core/concepts/remix-packages | Priority: high | Version: 1.0 | Updated: 2026-04-21 -->

# Remix Packages

Core packages in the Remix monorepo.

---

## Package Index

| Package | Description |
|---------|------------|
| **assert** | Assertion utilities for Remix |
| **async-context-middleware** | AsyncLocalStorage request context |
| **auth** | Browser login, OAuth, OIDC helpers |
| **auth-middleware** | Pluggable authentication |
| **component** | UI components |
| **compression-middleware** | HTTP response compression |
| **cookie** | Cookie toolkit |
| **cop-middleware** | Cross-origin protection |
| **cors-middleware** | CORS handling |
| **csrf-middleware** | CSRF protection |
| **data-schema** | Schema validation |
| **data-table** | Typed relational queries |
| **data-table-mysql** | MySQL adapter |
| **data-table-postgres** | PostgreSQL adapter |
| **data-table-sqlite** | SQLite adapter |
| **fetch-proxy** | HTTP proxy |
| **fetch-router** | Minimal Fetch API router |
| **file-storage** | File object storage |
| **file-storage-s3** | S3 backend |
| **form-data-middleware** | FormData parsing |
| **form-data-parser** | Streaming file uploads |
| **fs** | Web File API utils |
| **headers** | HTTP headers toolkit |
| **html-template** | HTML template tag |
| **lazy-file** | Streaming files |
| **logger-middleware** | HTTP logging |
| **method-override-middleware** | Method override |
| **mime** | MIME type utils |
| **multipart-parser** | Multipart parser |
| **node-fetch-server** | Node.js fetch server |
| **remix** | Web framework |
| **response** | Response helpers |
| **route-pattern** | URL routing |
| **session** | Session management |
| **session-middleware** | Session middleware |
| **session-storage-memcache** | Memcache storage |
| **session-storage-redis** | Redis storage |
| **static-middleware** | Static file serving |
| **tar-parser** | Tar stream parser |
| **test** | Browser testing |

---

## Package Categories

### Routing
- fetch-router, route-pattern

### Data
- data-table, data-schema, data-table-{mysql,postgres,sqlite}

### Auth
- auth, auth-middleware, session, session-middleware, csrf-middleware

### HTTP
- headers, response, cookie, cors-middleware, compression-middleware

### Files
- file-storage, file-storage-s3, form-data-parser, multipart-parser, tar-parser

### Middleware
- async-context-middleware, cop-middleware, method-override-middleware, logger-middleware, static-middleware

### UI
- component, html-template, test

---

## Related

- [monorepo-packages guide](../../guides/monorepo-packages.md)
- [data-table patterns](../../data/guides/data-table-queries.md)