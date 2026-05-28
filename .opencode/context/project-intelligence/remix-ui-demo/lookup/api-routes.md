---
title: API Routes
description: Route table for all 4 route groups in the demo
category: project-intelligence
type: lookup
source: config/routes.ts, app/api/controller.ts
---

# API Routes

## Core Concept

Routes are defined in `config/routes.ts` using `route()` and `get()` from `remix/routes`. Controllers map to each route group.

## Route Table

| Group | Path | Controller | Action |
|-------|------|------------|--------|
| `api` | `/api/airports` | `app/api/controller.ts` | `airports` — search with `?query=`/`?q=`, `?limit=` (max 500) |
| `examples` | `/examples/:slug` | `app/examples/controller.tsx` | `show` — full document |
| `examples` | `/examples/:slug/content` | `app/examples/controller.tsx` | `content` — preview with source |
| `themeBuilder` | `/theme-builder` | `app/theme-builder-controller.tsx` | Direct handler |
| `explorer` | `/` (and all page paths) | `app/explorer/controller.tsx` | Auto-generated from `PAGE_LIST` |

## Route Definition Pattern

```tsx
// config/routes.ts
export const routes = {
  api: route('/api', { airports: get('airports') }),
  examples: route('/examples', { content: get(':slug/content'), show: get(':slug') }),
  themeBuilder: get('/theme-builder'),
  explorer: route('/', explorerRoutes), // dynamic from PAGE_LIST
}
```

## Controller Mapping

```tsx
// config/router.tsx
router.map(routes.api, apiController)
router.map(routes.examples, examplesController)
router.map(routes.themeBuilder, themeBuilderController)
router.map(routes.explorer, explorerController)
```

## References

- `config/routes.ts` — All route definitions
- `config/router.tsx` — Controller-to-route mapping
- `app/api/controller.ts` — Airport search API handler
