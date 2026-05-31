# Guide: Nested Frames in the Admin Dashboard

## Overview

The admin dashboard at `/admin` uses nested frames for independent content
loading. The layout has two independent frame sections (stats + activity),
with the activity section containing nested user-detail frames.

## Frame Hierarchy

```
/admin (admin-content frame)
  └── Frame "admin-stats"             src: /admin/fragments/stats
  |     (loads quickly, ~500ms simulated)
  |
  └── Frame "admin-recent-activity"   src: /admin/fragments/recent-activity
        (loads slower, ~1200ms simulated)
        |
        └── Frame "user-detail-{id}"  src: /admin/fragments/user-detail/:userId
              (lazy, ~400ms simulated)
              Renders on "View details" click
```

## Routing

Fragment endpoints are defined under `admin.fragments` in `app/routes.ts`:

```typescript
admin: route('admin', {
  index: get('/'),
  // ... other routes ...

  fragments: route('fragments', {
    stats: get('/stats'),
    recentActivity: get('/recent-activity'),
    userDetail: get('/user-detail/:userId'),
  }),
})
```

## Controller

`app/actions/admin-fragments/controller.tsx` handles all fragment requests
with the same `requireAuth()` + `requireAdmin()` middleware as the main
admin routes. Each action:

1. Simulates a delay (so the frame fallback is visible)
2. Returns a fragment response using `fragmentResponseInit()` (no Layout
   wrapper, no DOCTYPE, `Cache-Control: no-store`)
3. Renders only the fragment's content

## Key Behaviors

- **Independent loading**: The stats frame loads in ~500ms while the activity
  frame takes ~1200ms. Neither blocks the other. The page renders both
  fallbacks immediately, then each replaces its fallback independently.
- **Lazy nested frames**: The user-detail frame inside activity entries only
  resolves when the activity frame's content renders it. It doesn't block
  the activity frame from appearing.
- **Unique names**: Each user-detail frame uses a unique `name` prop
  (`user-detail-{userId}`) to prevent state leakage.

## Fragment Response Schema

All fragment actions should use `fragmentResponseInit()`:

```typescript
import { fragmentResponseInit } from '../../middleware/render.tsx'

return context.render(<MyFragment />, fragmentResponseInit())
```

This sets `Cache-Control: no-store` and ensures the response is treated as a
standalone HTML fragment (no Layout wrapper).

## See Also

- `concepts/nested-frames.md` — general nested frames architecture
- `guides/client-entry-in-paginated-lists.md` — avoiding stale props in
  nested frames
- `guides/programmatic-frame-reload.md` — refreshing frame content
