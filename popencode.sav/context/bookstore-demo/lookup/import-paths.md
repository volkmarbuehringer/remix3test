<!-- Context: bookstore-demo/lookup/import-paths | Priority: high | Version: 1.0 | Updated: 2026-05-01 -->

# Bookstore Import Path Conventions

**Purpose**: Canonical import paths used in the bookstore project, especially for route map APIs that moved from `remix/fetch-router/routes` to `remix/routes`.

---

## Route Map Imports — `remix/routes`

Route-related helpers (`Route`, `del`, `get`, `post`, `put`, `route`, `form`, `resources`) MUST be imported from `remix/routes`, NOT `remix/fetch-router/routes`.

### Correct (migrated)

```typescript
// bookstore/app/routes.ts
import { del, get, post, put, route, form, resources } from 'remix/routes'

// bookstore/app/middleware/auth.ts
import type { Route } from 'remix/routes'
```

### Wrong (pre-migration)

```typescript
import { get, post, route } from 'remix/fetch-router/routes'  // ✗ Stale
```

### Why

Route map APIs were moved out of the `remix/fetch-router` subpackage into `remix/routes`. All route definition files and any code importing `Route` as a type must use the new path.

---

## General Framework Imports — `remix/fetch-router`

The following imports still come from `remix/fetch-router` (NOT affected by the migration):

```typescript
import type { Controller } from 'remix/fetch-router'
import type { BuildAction } from 'remix/fetch-router'
import type { Middleware } from 'remix/fetch-router'
import type { Router, RequestContext } from 'remix/fetch-router'
import { createContextKey } from 'remix/fetch-router'
```

These are framework-level types and remain unchanged. Only the `routes` subpath moved.

---

## Quick Reference

| Import              | Module                     | Status   |
|---------------------|----------------------------|----------|
| `Route` (type)      | `remix/routes`             | Migrated |
| `del`               | `remix/routes`             | Migrated |
| `get`               | `remix/routes`             | Migrated |
| `post`              | `remix/routes`             | Migrated |
| `put`               | `remix/routes`             | Migrated |
| `route`             | `remix/routes`             | Migrated |
| `form`              | `remix/routes`             | Migrated |
| `resources`         | `remix/routes`             | Migrated |
| `Controller` (type) | `remix/fetch-router`       | Unchanged |
| `BuildAction` (type)| `remix/fetch-router`       | Unchanged |
| `Middleware` (type) | `remix/fetch-router`       | Unchanged |
| `Router` (type)     | `remix/fetch-router`       | Unchanged |
| `RequestContext`    | `remix/fetch-router`       | Unchanged |
| `createContextKey`  | `remix/fetch-router`       | Unchanged |

---

## Codebase References

| File | Lines | Note |
|------|-------|------|
| `bookstore/app/routes.ts` | Line 1 | `import { del, get, post, put, route, form, resources } from 'remix/routes'` |
| `bookstore/app/middleware/auth.ts` | Line 1 | `import type { Route } from 'remix/routes'` |
| `bookstore/app/controllers/*/controller.tsx` | Line 1 (many) | `import type { Controller } from 'remix/fetch-router'` — unchanged |
| `bookstore/app/router.ts` | Line 7 | `import type { Router } from 'remix/fetch-router'` — unchanged |

---

## Related Context

- [development/remix3/concepts/routing.md](../development/remix3/concepts/routing.md) — Route definition patterns
- [development/remix3/examples/form-data-patterns.md](../development/remix3/examples/form-data-patterns.md) — Form route examples
- [development/remix3/guides/auth-middleware.md](../development/remix3/guides/auth-middleware.md) — Auth middleware patterns
