<!-- Context: development/remix3/packages | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Remix Packages Index

Complete package index for the Remix monorepo at `/home/lucky/remix/packages/`

## Package Categories

| Category | Path | Count |
|----------|------|-------|
| **Core** | `core/` | 8 |
| **Middleware** | `middleware/` | 9 |
| **Data** | `data/` | 6 |
| **Utilities** | `utilities/` | 12 |
| **Storage** | `storage/` | 2 |
| **Servers** | `servers/` | 2 |

## Quick Reference

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `fetch-router` | HTTP routing | `createRouter`, `route()`, `form()` |
| `auth` | Authentication | `verifyCredentials`, `startExternalAuth`, `refreshExternalAuth`, `completeAuth` |
| `session` | Sessions | `createCookieSessionStorage`, `createMemorySessionStorage` |
| `cookie` | Cookies | `createCookie` |
| `data-table` | Database queries | `query()`, `db.find()`, `db.create()` |
| `form-data-middleware` | Form parsing | `formData()` |
| `response` | Response helpers | `createHtmlResponse`, `createRedirectResponse`, `createFileResponse`, `compressResponse` |
| `file-storage` | File storage | `createFsFileStorage` |
| `remix/ui` | UI components & theming | `clientEntry`, `run`, `on`, `css`, `createTheme`, `createMixin`, `Fragment`, `Frame` |

## Installation

All packages: `npm i remix`

Individual imports:
```ts
import { createRouter } from 'remix/fetch-router'
import { createCookie } from 'remix/cookie'
import { query } from 'remix/data-table'
```

## Navigation

- `lookup/api-snapshot.md` - Full export index (v3.0.0-beta.0)
- `lookup/package-index.md` - Structured per-package docs
- `core/fetch-router.md` - Main HTTP router
- `core/auth.md` - Authentication primitives
- `core/session.md` - Session management
- `core/cookie.md` - Cookie handling
- `core/response.md` - Response helpers
- `data/data-table.md` - Database queries
- `data/file-storage.md` - File storage

### Concepts (Per-Package)

- `concepts/ecosystem-overview.md` - Map of all 46 packages by function
- `concepts/remix.md` - Metapackage + CLI entry points
- `concepts/test.md` - Built-in test framework (describe/it, mocks, E2E, coverage)
- `concepts/breaking-changes-v3.md` - v3.0.0-beta.1 breaking changes
- `concepts/atmosphere-auth.md` - ATProtocol/Bluesky OAuth with DPoP binding
- `concepts/assets.md` - On-demand asset compilation + serving
- `concepts/file-transforms.md` - Leaf asset transform pipeline (request + global)
- `concepts/fingerprinting-caching.md` - Content-hash URLs, ETag, cache headers
- `concepts/cli.md` - CLI commands and programmatic usage
- `concepts/data-schema.md` - Data validation (parse/parseSafe, Standard Schema v1)
- `concepts/form-data-parsing.md` - FormData & URLSearchParams schema parsing
- `concepts/node-serve.md` - High-performance uWebSockets.js server
- `concepts/node-tsx.md` - TypeScript/JSX loader for Node.js
- `concepts/render-middleware.md` - Request-scoped render middleware

### Guides (Per-Package)

- `guides/asset-server-configuration.md` - Full createAssetServer options reference
- `guides/data-table-migrations.md` - Migration runner, dry-run, transaction modes, filesystem loading
- `guides/extending-data-schema.md` - Custom schemas with createSchema/createIssue/fail

## Source

All source READMEs: `/home/lucky/remix/packages/*/README.md`