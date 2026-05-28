<!-- Context: development/remix3/packages/lookup | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Remix 3 Package Index

Quick reference table of all Remix 3 packages with categories and key exports.

---

## Middleware Packages

| Package | Category | Key Exports | Purpose |
|---------|----------|-------------|---------|
| `async-context-middleware` | Middleware | `asyncContext()`, `getContext()` | Request-scoped async context via AsyncLocalStorage |
| `auth-middleware` | Middleware | `auth()`, `requireAuth()`, `createSessionAuthScheme()` | Request-time auth resolution and route protection |
| `compression-middleware` | Middleware | `compression()` | Response compression (br/gzip/deflate) |
| `cors-middleware` | Middleware | `cors()` | CORS headers and preflight handling |
| `csrf-middleware` | Middleware | `csrf()`, `getCsrfToken()` | CSRF token validation with session backing |
| `fetch-proxy` | Middleware | `createFetchProxy()` | HTTP proxy to forward requests |
| `logger-middleware` | Middleware | `logger()` | Request/response logging |
| `method-override-middleware` | Middleware | `methodOverride()` | Form method override (PUT/PATCH/DELETE) |
| `session-middleware` | Middleware | `session()` | Session lifecycle in request context |
| `static-middleware` | Middleware | `staticFiles()` | Static file serving with caching |
| `cop-middleware` | Middleware | `cop()` | Browser-origin protection (tokenless CSRF) |

---

## Core Packages

| Package | Category | Key Exports | Purpose |
|---------|----------|-------------|---------|
| `auth` | Core | `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, `completeAuth()` | Browser auth primitives (OAuth/OIDC/credentials) |
| `component` | Core | `renderToStream`, `clientEntry`, `run`, `Frame` | Minimal JSX component system |
| `cookie` | Core | `createCookie()` | Cookie parsing/serialization with HMAC signing |
| `fetch-router` | Core | `createRouter()`, `route()`, `form()` | Fetch API router with middleware |
| `fs` | Core | `openLazyFile()`, `writeFile()` | Lazy filesystem utilities |
| `headers` | Core | `Accept`, `CacheControl`, `ContentType`, `Cookie`, etc. | Typed HTTP header manipulation |
| `html-template` | Core | `html` | Safe HTML template literals with auto-escaping |
| `lazy-file` | Core | `LazyFile`, `LazyBlob` | Streaming Blob/File implementation |
| `mime` | Core | `detectMimeType()`, `isCompressibleMimeType()` | MIME type detection |
| `multipart-parser` | Core | `parseMultipartRequest()`, `parseMultipart()` | Streaming multipart parser |
| `response` | Core | `createHtmlResponse()`, `createRedirectResponse()`, `createFileResponse()` | Response helpers |
| `route-pattern` | Core | `RoutePattern`, `ArrayMatcher`, `TrieMatcher` | Type-safe URL matching |
| `session` | Core | `Session`, `createCookieSessionStorage()`, `createFsSessionStorage()` | Session management |

---

## Data Packages

| Package | Category | Key Exports | Purpose |
|---------|----------|-------------|---------|
| `data-schema` | Data | `string()`, `number()`, `object()`, `parse()` | Tiny validation (Standard Schema v1) |
| `data-table` | Data | `createDatabase()`, `table()`, `query()`, `hasMany()` | Typed relational queries |
| `data-table-mysql` | Data | `createMysqlDatabaseAdapter()` | MySQL adapter |
| `data-table-postgres` | Data | `createPostgresDatabaseAdapter()` | PostgreSQL adapter |
| `data-table-sqlite` | Data | `createSqliteDatabaseAdapter()` | SQLite adapter |

---

## Storage Packages

| Package | Category | Key Exports | Purpose |
|---------|----------|-------------|---------|
| `file-storage` | Storage | `createFsFileStorage()`, `createMemoryFileStorage()` | Key/value File storage |
| `file-storage-s3` | Storage | `createS3FileStorage()` | S3 backend for file-storage |
| `session-storage-memcache` | Storage | `createMemcacheSessionStorage()` | Memcache session storage |
| `session-storage-redis` | Storage | `createRedisSessionStorage()` | Redis session storage |

---

## Server Package

| Package | Category | Key Exports | Purpose |
|---------|----------|-------------|---------|
| `node-fetch-server` | Server | `createRequestListener()`, `createRequest()` | Node.js HTTP server with Fetch API |

---

## Other Packages

| Package | Category | Key Exports | Purpose |
|---------|----------|-------------|---------|
| `form-data-parser` | Other | `parseFormData()`, `FileUpload` | Form data parsing with custom upload handler |
| `form-data-middleware` | Other | `formData()` | Form body parsing middleware |
| `tar-parser` | Other | `parseTar()` | Streaming tar archive parser |

---

## Import Path Patterns

```ts
// Middleware
import { auth } from 'remix/auth-middleware'
import { session } from 'remix/session-middleware'

// Core
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { html } from 'remix/html-template'

// Data
