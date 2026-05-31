<!-- Context: development/remix3/guides/controller-creation | Priority: high | Version: 1.1 | Updated: 2026-05-03 -->

# Controller Creation

## Root Controller Pattern

The root controller at `app/actions/controller.tsx` owns top-level Route leaves across all route groups. It uses `satisfies Controller<typeof routes>` to type-check against the full routes map. Route leaves that were previously standalone `BuildAction` files can be consolidated directly as controller action keys.

```typescript
// app/actions/controller.tsx
import type { Controller } from 'remix/fetch-router'
import { createAssetServer } from 'remix/assets'
import type { routes } from '../routes.ts'
import { render } from './render.tsx'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'app/routes.ts', 'app/ui/**', 'node_modules/**'],
})

export default {
  actions: {
    async assets({ request }) {
      let response = await assetServer.fetch(request)
      return response ?? new Response('Not Found', { status: 404 })
    },
    home() { return render(<Layout><HomePage /></Layout>) },
    authLogout() {
      getContext().get(Session).unset('auth')
      return new Response(null, { status: 302, headers: { Location: '/' } })
    },
    async messagesContent({ url }) { /* paginated fragment */ },
    messagesSubscribe() { /* SSE ReadableStream */ },
  },
} satisfies Controller<typeof routes>
```

**Asset server co-location**: Two patterns exist depending on whether you want to avoid circular dependencies:

- **Inline in controller** (my_app): `export const assetServer` in `controller.tsx`. `render.tsx` imports `assetServer` from `./controller.tsx`. This creates a circular dependency (`controller.tsx` ↔ `render.tsx`) that works via ESM live bindings — `assetServer` is assigned before any handler runs. Simple but fragile; only works because the value is initialized at module scope before handlers execute.
- **Separate module** (bookstore): `app/actions/asset-server.ts` holds the `createAssetServer` config. Both `controller.tsx` and `render.tsx` import from this shared module. Completely avoids circular deps. Prefer this pattern when adding other modules that also need `assetServer`.

## Sub-Controller for a RouteMap

Each RouteMap gets its own controller at `app/actions/{name}/controller.tsx`. The controller uses `satisfies Controller<typeof routes.{name}>` for the narrowed route type.

```typescript
// app/actions/messages/controller.tsx
import type { Controller } from 'remix/fetch-router'
import type { routes } from '../../routes.ts'

export default {
  middleware: [requireAuth()],  // optional per-controller middleware

  actions: {
    async index() { /* GET /messages */ },
    async action() { /* POST /messages */ },
  },
} satisfies Controller<typeof routes.messages>
```

## Controller Structure

```typescript
export default {
  // Optional: inline middleware for all actions in this controller
  middleware?: AnyMiddleware[]

  actions: {
    // Keys MUST match Route leaf names in the RouteMap
    [routeLeafName]: ActionHandler,
  },
} satisfies Controller<typeof routes.SomeRouteMap>
```

## Inline Middleware

Controllers can apply middleware to all their actions:

```typescript
export default {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index() { /* requireAuth + requireAdmin applied */ },
    chatlog: chatlogHandler,
  },
} satisfies Controller<typeof routes.admin>
```

## BuildAction for Simple Leaves

For single Route leaves registered via `router.get('/path', handler)` or `router.post('/path', handler)`, use `BuildAction`:

```typescript
// app/actions/home.tsx
import type { BuildAction } from 'remix/fetch-router'
import type { routes } from '../routes.ts'

export const home: BuildAction<'GET', typeof routes.home> = {
  handler() {
    return render(<HomePage />)
  },
}
```

Used via `router.get(routes.home, home)`.

**Two patterns coexist across projects:**

| Project | Root Route Registration | Standalone BuildAction files? |
|---------|------------------------|-------------------------------|
| **my_app** | `router.map(routes, rootController)` — consolidated | No — all root leaves are in controller actions |
| **bookstore** | mix: `router.map()` for RouteMaps + individual `router.get()` for leaves | Yes — `home.tsx`, `about.tsx`, `search.tsx`, `books1.tsx`, etc. exist alongside the controller |

**When to consolidate into the root controller's `actions`:**
- The route belongs to the top-level RouteMap
- Handler is small (<30 lines) and doesn't have its own dependency tree
- You want a single `router.map(routes, controller)` call

**When to keep a standalone `BuildAction`:**
- The handler has significant logic or its own dependency tree
- The route is registered via `router.get()`/`router.post()` separately from the main RouteMap
- The route is semantically distinct (e.g., an SSE endpoint, file upload handler)

## Custom Key Controller

When a controller handles a route with a custom key name:

```typescript
// router.map({ messagesSubscribe: routes.messagesSubscribe }, ctrl)
export default {
  actions: {
    messagesSubscribe() { /* SSE handler */ },
  },
} satisfies Controller<{ messagesSubscribe: typeof routes.messagesSubscribe }>
```

## Reference Controllers

| File | Description |
|---|---|
| `my_app/app/actions/controller.tsx` | Root controller — consolidated assets, home, authLogout, messagesContent, messagesSubscribe + assetServer export |
| `my_app/app/actions/render.tsx` | Co-located render utility — `new Response`, `resolveFrame(src, target)` |
| `my_app/app/actions/messages/controller.tsx` | Sub-controller with middleware |
| `my_app/app/actions/admin/controller.tsx` | Sub-controller with chatlog delegation |
