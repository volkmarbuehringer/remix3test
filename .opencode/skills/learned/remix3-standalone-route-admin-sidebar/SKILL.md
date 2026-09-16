---
name: remix3-standalone-route-admin-sidebar
description: "Use when adding a standalone route to the Remix 3 admin sidebar — SSE auth returns 401 (not a redirect) and set `iframeNav: false`."
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

Direct registration via `router.get()`/`router.post()` and `router.map()` composition of multiple named route-tree exports is covered by the vendor `remix` skill and guide chapter 02 ("Mapping controllers"). See also the `remix-cli-devops` note on CLI route-tree discovery.

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

In `app/ui/admin-layout.tsx`, add the standalone route as a nav item with `iframeNav: false` — it forces a full-page navigation instead of frame navigation (`document: true` instead of `target: frameTarget`).

### 3. SSE endpoints need 401-auth, not redirect-auth

`EventSource` cannot follow 302 redirects. Using `requireAuth()` on an SSE endpoint causes the EventSource to silently fail when redirecting to login.

Use the repo's `requireSseAuth()` middleware (`app/middleware/sse-auth.ts`) on any non-interactive endpoint (EventSource, WebSocket):

```tsx
export const mySseHandler = createAction<typeof mySseRoute, AppContext>(mySseRoute, {
  middleware: [requireSseAuth()],
  handler: async (context) => channel.subscribe(context.request),
})
```

**Note:** This section replaces the standalone `remix3-sse-auth-401` skill. The `requireSseAuth()` middleware is the same pattern — use it instead of `requireAuth()` on any non-interactive endpoint.

Auth state check behavior (`context.get(Auth)`):

| `auth` value               | Result         |
| -------------------------- | -------------- |
| `loadAuth()` not installed | 401            |
| No valid session (`!auth.ok` or no `identity`) | 401            |
| Valid session             | passes through |

### 4. Client IP extraction

For client IP extraction, use the corrected two-tier trust model — see `remix3-two-tier-ip-trust-model`. Do NOT enable `trustProxy: true` without a stripping reverse proxy; it allows client spoofing of forwarded headers.

### 5. Rendering standalone pages

Standalone routes render their own Document + Layout — no `renderAdminPage`. This matches the standard "Document shells" / "Rendering pages through request context" patterns in guide chapter 04:

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