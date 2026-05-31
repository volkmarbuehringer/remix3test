<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Remix Package Ecosystem

**Purpose**: One-page map of all 46 packages in the Remix monorepo, grouped by functional area. All installed via `npm i remix` and imported as `remix/<subpath>`.

## Core

| Package | Purpose |
|---------|---------|
| `remix` | Metapackage + CLI (`new`, `doctor`, `routes`, `test`) |
| `route-pattern` | Type-safe URL matching and href generation |
| `fetch-router` | Fetch API router with middleware and typed context |

## Middleware (Built-in)

| Import | Package | Purpose |
|--------|---------|---------|
| `remix/middleware/auth` | auth-middleware | Request-time auth resolution and route protection |
| `remix/middleware/session` | session-middleware | Load/persist session per request |
| `remix/middleware/async-context` | async-context-middleware | AsyncLocalStorage request context |
| `remix/middleware/compression` | compression-middleware | Response compression (br, gzip, deflate) |
| `remix/middleware/cop` | cop-middleware | Cross-origin protection (tokenless) |
| `remix/middleware/cors` | cors-middleware | CORS headers and preflight handling |
| `remix/middleware/csrf` | csrf-middleware | Session-backed CSRF tokens |
| `remix/middleware/form-data` | form-data-middleware | Request body → `context.formData` |
| `remix/middleware/logger` | logger-middleware | Request/response logging |
| `remix/middleware/method-override` | method-override-middleware | HTML form method override |
| `remix/middleware/render` | render-middleware | Request-scoped render function |
| `remix/middleware/static` | static-middleware | Static file serving |

## Auth & Session: `auth`, `session`, `session-storage/{cookie,fs,memory,redis,memcache}`

## Data: `data-schema`, `data-table`, `data-table/{postgres,mysql,sqlite}`

## Server: `node-serve` (uWS), `node-fetch-server` (node:http), `node-tsx` (TS loader)

## HTTP & Headers: `cookie`, `headers`, `mime`, `response`

## Assets & Files: `assets`, `lazy-file`, `file-storage`, `file-storage/s3`, `fs`

## UI & Templating: `ui` (components/theming), `html-template` (safe HTML)

## Parsers: `form-data-parser`, `multipart-parser`, `tar-parser`

## Testing & Dev Tools: `test` (framework), `terminal` (ANSI), `assert` (expect)

**Reference**: `/home/lucky/remix/packages/*/README.md`
