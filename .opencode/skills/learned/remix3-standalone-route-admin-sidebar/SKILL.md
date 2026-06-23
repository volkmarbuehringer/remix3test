---
name: remix3-standalone-route-admin-sidebar
description: "Add standalone routes to Remix 3 admin sidebar with SSE and client IP"
origin: auto-extracted
---

# Standalone Route with Admin Sidebar Integration

**Extracted:** 2026-06-23
**Context:** Adding external-facing routes (webhooks, API endpoints) to a Remix 3 app while linking them from the admin sidebar

## Problem

Routes that are not nested under the admin route tree (registered via `router.get()`/`router.post()` directly, not via `router.map(routes.admin.xxx)`) cannot use `renderAdminPage()` because the admin layout uses Frame-based navigation (`X-Remix-Target`). Attempting to render a standalone page through `renderAdminPage()` causes crashes or blank pages.

Additionally, SSE endpoints linked from admin pages need authentication, but `EventSource` cannot follow HTTP redirects (302) — standard `requireAuth()` silently breaks SSE connections.

## Solution

### 1. Register standalone routes outside the route tree

```tsx
// app/routes.ts — export standalone routes separately
export const myRoute = get('/my-path')
export const mySseRoute = get('/my-path/events')

// app/router.ts — wire directly
import { myRoute, mySseRoute } from './routes.ts'
import { myHandler, mySseHandler } from './actions/my-feature/controller.tsx'

router.get(myRoute, myHandler)
router.get(mySseRoute, mySseHandler)
```

### 2. Link from admin sidebar with `iframeNav: false`

```tsx
// app/ui/admin-layout.tsx
import { myRoute } from '../routes.ts'

export type AdminNavItem =
  | 'dashboard' | ... | 'myFeature'

const NAV_GROUPS: NavGroup<AdminNavItem>[] = [
  {
    label: 'Daten',
    items: [
      { id: 'myFeature', label: 'My Feature', route: myRoute, iframeNav: false },
      //                                          ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^
      //                                          standalone route  full-page nav, not frame
    ],
  },
]

function navIcon(id: AdminNavItem): RemixNode {
  switch (id) {
    case 'myFeature': return mySvg()
  }
}
```

The `iframeNav: false` prop forces a full-page navigation instead of frame navigation (`document: true` instead of `target: frameTarget`).

### 3. SSE endpoints need 401-auth, not redirect-auth

`EventSource` cannot follow 302 redirects. Using `requireAuth()` on an SSE endpoint causes the EventSource to silently fail when redirecting to login.

Create a custom middleware that returns 401 instead:

```tsx
// app/middleware/sse-auth.ts
import type { Middleware } from 'remix/router'
import { Auth } from 'remix/middleware/auth'

export function requireSseAuth(): Middleware {
  return async (context, next) => {
    let auth = context.get(Auth)
    if (!auth || !('user' in auth) || !auth.user) {
      return new Response('Unauthorized', { status: 401 })
    }
    return next()
  }
}
```

Usage on the SSE route:

```tsx
export const mySseHandler = createAction<typeof mySseRoute, AppContext>(
  mySseRoute,
  {
    middleware: [requireSseAuth()],
    handler: async (context) => channel.subscribe(context.request),
  },
)
```

### 4. Client IP extraction with socket fallback

When `X-Forwarded-For` and `X-Real-Ip` are unavailable (direct connections), fall back to the TCP socket remote address:

```tsx
// server.ts
const handler = createRequestListener(
  async (request, client) => {
    if (client?.address) {
      request.headers.set('X-Client-Ip', client.address)
    }
    return await router.fetch(request)
  },
  { trustProxy: true },
)
```

Then in your handler:

```tsx
let sourceIp =
  context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
  context.request.headers.get('X-Real-Ip') ??
  context.request.headers.get('X-Client-Ip') ??
  ''
```

### 5. Rendering standalone pages

Standalone routes render their own Document + Layout — no `renderAdminPage`:

```tsx
export const myHandler = createAction<typeof myRoute, AppContext>(
  myRoute,
  {
    middleware: [requireAuth()],
    handler: async (context) => {
      return context.render(
        <Document title="My Feature">
          <Layout>
            <MyPage ... />
          </Layout>
        </Document>,
      )
    },
  },
)
```

## When to Use

- Adding a new feature route that should appear in the admin sidebar but isn't part of the admin route tree
- Adding external-facing endpoints (webhooks, API routes) that need admin sidebar navigation
- Adding SSE endpoints to admin pages
- Any case where `renderAdminPage` causes crashes or Frame conflicts
