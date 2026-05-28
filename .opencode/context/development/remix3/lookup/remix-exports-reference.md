<!-- Context: development/remix3/lookup/remix-exports-reference | Priority: medium | Version: 1.0 | Updated: 2026-05-05 -->

# Remix Package Export Map

**Core Idea**: All 60+ `remix/<subpath>` exports from `packages/remix/package.json`. The `remix` package re-exports all `@remix-run/*` packages as subpath imports.

| Category | Import | Source Package |
|----------|--------|---------------|
| **Routing** | `remix/routes` | `@remix-run/routes` |
| | `remix/fetch-router` | `@remix-run/fetch-router` |
| | `remix/route-pattern` | `@remix-run/route-pattern` |
| | `remix/route-pattern/specificity` | `@remix-run/route-pattern` |
| | `remix/node-fetch-server` | `@remix-run/node-fetch-server` |
| | `remix/node-fetch-server/test` | `@remix-run/node-fetch-server` |
| | `remix/node-serve` | `@remix-run/node-serve` |
| **Middleware** | `remix/static-middleware` | `@remix-run/static-middleware` |
| | `remix/form-data-middleware` | `@remix-run/form-data-middleware` |
| | `remix/async-context-middleware` | `@remix-run/async-context-middleware` |
| | `remix/compression-middleware` | `@remix-run/compression-middleware` |
| | `remix/logger-middleware` | `@remix-run/logger-middleware` |
| | `remix/method-override-middleware` | `@remix-run/method-override-middleware` |
| | `remix/cors-middleware` | `@remix-run/cors-middleware` |
| | `remix/csrf-middleware` | `@remix-run/csrf-middleware` |
| | `remix/cop-middleware` | `@remix-run/cop-middleware` |
| | `remix/session-middleware` | `@remix-run/session-middleware` |
| | `remix/auth-middleware` | `@remix-run/auth-middleware` |
| **Auth** | `remix/auth` | `@remix-run/auth` |
| | `remix/session` | `@remix-run/session` |
| | `remix/session/cookie-storage` | `@remix-run/session` |
| | `remix/session/fs-storage` | `@remix-run/session` |
| | `remix/session/memory-storage` | `@remix-run/session` |
| | `remix/session-storage-redis` | `@remix-run/session-storage-redis` |
| | `remix/session-storage-memcache` | `@remix-run/session-storage-memcache` |
| | `remix/cookie` | `@remix-run/cookie` |
| **Data** | `remix/data-schema` | `@remix-run/data-schema` |
| | `remix/data-schema/checks` | `@remix-run/data-schema` |
| | `remix/data-schema/coerce` | `@remix-run/data-schema` |
| | `remix/data-schema/form-data` | `@remix-run/data-schema` |
| | `remix/data-schema/lazy` | `@remix-run/data-schema` |
| | `remix/data-table` | `@remix-run/data-table` |
| | `remix/data-table/migrations` | `@remix-run/data-table` |
| | `remix/data-table/migrations/node` | `@remix-run/data-table` |
| | `remix/data-table/operators` | `@remix-run/data-table` |
| | `remix/data-table/sql-helpers` | `@remix-run/data-table` |
| | `remix/data-table-sqlite` | `@remix-run/data-table-sqlite` |
| | `remix/data-table-postgres` | `@remix-run/data-table-postgres` |
| | `remix/data-table-mysql` | `@remix-run/data-table-mysql` |
| **UI** | `remix/ui` | `@remix-run/ui` |
| | `remix/ui/server` | `@remix-run/ui` |
| | `remix/ui/animation` | `@remix-run/ui` |
| | `remix/ui/test` | `@remix-run/ui` |
| | `remix/ui/jsx-runtime` | `@remix-run/ui` |
| | `remix/ui/jsx-dev-runtime` | `@remix-run/ui` |
| **Responses** | `remix/response/html` | `@remix-run/response` |
| | `remix/response/redirect` | `@remix-run/response` |
| | `remix/response/file` | `@remix-run/response` |
| | `remix/response/compress` | `@remix-run/response` |
| **Assets** | `remix/assets` | `@remix-run/assets` |
| | `remix/file-storage` | `@remix-run/file-storage` |
| | `remix/file-storage/fs` | `@remix-run/file-storage` |
| | `remix/file-storage/memory` | `@remix-run/file-storage` |
| | `remix/file-storage-s3` | `@remix-run/file-storage-s3` |
| | `remix/form-data-parser` | `@remix-run/form-data-parser` |
| | `remix/multipart-parser` | `@remix-run/multipart-parser` |
| | `remix/multipart-parser/node` | `@remix-run/multipart-parser` |
| **Utilities** | `remix/headers` | `@remix-run/headers` |
| | `remix/html-template` | `@remix-run/html-template` |
| | `remix/mime` | `@remix-run/mime` |
| | `remix/lazy-file` | `@remix-run/lazy-file` |
| | `remix/fs` | `@remix-run/fs` |
| | `remix/tar-parser` | `@remix-run/tar-parser` |
| | `remix/terminal` | `@remix-run/terminal` |
| | `remix/assert` | `@remix-run/assert` |
| | `remix/fetch-proxy` | `@remix-run/fetch-proxy` |
| **CLI/Test** | `remix/cli` | `@remix-run/cli` |
| | `remix/test` | `@remix-run/test` |
| | `remix/test/cli` | `@remix-run/test` |

## Source
`packages/remix/package.json` → `exports` field. See also `packages/lookup/package-index.md`.
