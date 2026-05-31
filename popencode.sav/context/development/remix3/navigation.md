# Remix 3 Development Context

**Purpose**: Context for Remix 3 — routing, middleware, auth, data, UI, server setup, SSE, testing, and packages.

## Category Index

| Category | Files | Entry Point |
|----------|-------|-------------|
| **[Core](core/navigation.md)** | 14 | Rules, principles, CLI, design decisions |
| **[Middleware](middleware/navigation.md)** | 12 | CORS, CSRF, compression, sessions, static files |
| **[Routing](routing/navigation.md)** | 12 | Route definitions, controllers, router mapping |
| **[Data](data/navigation.md)** | 22 | Schemas, tables, FormData, DB setup, CRUD |
| **[Auth](auth/navigation.md)** | 11 | Sessions, cookies, OAuth, credentials, storage |
| **[Security](security/navigation.md)** | 4 | CSRF, session security, error response standards |
| **[UI](ui/navigation.md)** | 80 | Components, hydration, frames, mixins, animation, theme, errors |
| **[SSE](sse/navigation.md)** | 6 | Server-Sent Events — streaming + EventSource |
| **[Server](server/navigation.md)** | 5 | Node adapters, rendering, graceful shutdown |
| **[Testing](test/navigation.md)** | 11 | Router tests, component tests, assertions, E2E |
| **[Packages](packages/navigation.md)** | 63 | Full package index with categories and exports |

## Remaining Context (Cross-Cutting)

These directories contain files that apply across multiple categories:

| Category | Files | Entry Point |
|----------|-------|-------------|
| **[Locale](locale/navigation.md)** | 1 | German locale conventions, `lang="de"`, `Intl` API with `'de-DE'` |
| **[Concepts](concepts/navigation.md)** | 3 | Foundational: chat-log, lazy-loading, SSR-client boundary (package concepts in [Packages](packages/navigation.md)) |
| **[Guides](guides/navigation.md)** | 35 | Cross-cutting: pagination, sorting, forms, form-loading, chat SSR, rate limiting, action types, frame navigation, manual fetch, inline editing, server-embedded JSON |
| **[Examples](examples/navigation.md)** | 10 | Demo extracts: bookstore, frames, asset-server, unpkg |
| **[Lookup](lookup/navigation.md)** | 24 | References: web standards, API refs, migration, browser shims |
| **[Errors](errors/navigation.md)** | 17 | Common issues: client-entry, CORS, CSRF, frames, validation |

> **Note**: Some `concepts/` files have counterparts in `packages/concepts/`. The concepts here focus on usage patterns; `packages/concepts/` provides package-level API documentation.

## Source

- **Phase 1–2**: Harvested from `~/remix/skills/remix/SKILL.md` + package READMEs
- **Phase 3**: Extracted from `~/remix/template/` — starter scaffold patterns
- **Phase 4**: Extracted from `~/remix/demos/` — auth, frame-nav, SSE, unpkg patterns

## Related

- `/development/remix3/guides/` — Guides for forms, pagination, sorting, admin, chat
- `/development/remix3/errors/` — Common issues and gotchas
