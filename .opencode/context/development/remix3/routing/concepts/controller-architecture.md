<!-- Context: development/remix3/routing/concepts/controller-architecture | Priority: high | Version: 1.2 | Updated: 2026-05-07 -->

# Controller Architecture

## Concept

Controllers map route leaves (individual `Route` objects) to action handlers. Each `RouteMap` gets its own controller; controllers **cannot nest** other controllers in their `actions` property.

## Key Points

- Controllers live in `app/actions/` (not `app/controllers/`) — enforced by `remix doctor`
- Each `RouteMap` is mapped independently via its own `router.map()` call
- Root `app/actions/controller.tsx` handles top-level Route leaves (home, assets, etc.)
- Sub-controllers in `app/actions/{name}/controller.tsx` handle their RouteMap
- Simple single-route leaves use `BuildAction<'GET', typeof routes.x>` instead of a full Controller
- Type safety via `satisfies Controller<typeof routes.X>`

## Type: ControllerActions

The `Controller` type uses `ControllerActions`, which enforces:

```typescript
type ControllerActions<routes extends RouteMap, context> = {
  // Route keys → MUST have action handlers
  [name in keyof routes as routes[name] extends Route ? name : never]: Action<...>
} & {
  // RouteMap keys → MUST be `?: never` (no nesting!)
  [name in keyof routes as routes[name] extends RouteMap ? name : never]?: never
}
```

This means:
- Route leaf keys MUST have a corresponding action handler
- RouteMap keys MUST NOT appear in controller actions
- Nested RouteMaps require their own separate controller + `router.map()` call

If you violate this at runtime, fetch-router throws:
```
TypeError: Cannot map nested route map key `{name}` in controller actions;
call router.map() for that route map separately
```

## Architecture Layout

```
app/
├── routes.ts              # Route definitions (app/routes.ts, not config/routes.ts)
├── router.ts              # Wire routes to controllers via router.map() and router.get/post()
└── actions/
    ├── controller.tsx     # Root: ALL top-level Route leaves + assetServer export
    ├── render.tsx         # Co-located render utility (new Response, resolveFrame)
    ├── messages/
    │   ├── controller.tsx # Sub-controller for messages RouteMap
    │   └── page.tsx       # Route-owned component
    ├── chat/
    │   └── controller.tsx # Sub-controller for chat RouteMap
    └── admin/
        ├── controller.tsx # Sub-controller for admin RouteMap
        ├── page.tsx
        └── lists/
            ├── controller.tsx # Controller for admin.lists RouteMap
            └── index-page.tsx
```

**Key changes**: Standalone `BuildAction` files (`home.tsx`, `assets.tsx`, `auth-logout.tsx`, etc.) are consolidated into the root controller's `actions` object. The render utility is co-located in `app/actions/` (not `app/utils/`).

## AppController Pattern

To bind middleware types into controllers (restoring accurate `get()` return types after `RequestContext.get()` changed to return `undefined`), the app defines an `AppController` type alias in `router.ts`:

```typescript
// router.ts — binds full middleware stack into controller context types
export type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type AppContext<params extends AnyParams = {}> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>

export type AppController<routes extends RouteMap> = Controller<routes, AppContext>
```

Controllers import `AppController` from the local router instead of `Controller` from `remix/fetch-router`:

```typescript
import type { AppController } from '../../router.ts'
import type { routes } from '../../routes.ts'

export default { actions: { /* ... */ } } satisfies AppController<typeof routes.chat>
```

**Why**: Without `AppController`, `context.get(Key)` in controller actions returns `T | undefined` because TypeScript doesn't know which middleware has run. With the bound `AppContext`, middleware-provided values resolve to their concrete types.

See also: `../../middleware/concepts/request-context-get-pattern.md` — null-check pattern for unbound contexts.

## References

- `my_app/app/actions/controller.tsx` — Root controller (consolidated, with assetServer export)
- `my_app/app/actions/render.tsx` — Co-located render utility
- `my_app/app/actions/messages/controller.tsx` — Sub-controller for RouteMap
- `my_app/app/router.ts` — `AppController` type definition, `router.map()` for root leaves
- `my_app/app/actions/chat/controller.tsx` — `satisfies AppController<typeof routes.chat>`
- `bookstore/app/actions/controller.tsx` — Root controller (more leaves)
- `bookstore/app/actions/asset-server.ts` — Shared asset server module
- `bookstore/app/actions/render.tsx` — Co-located render utility
- `bookstore/app/actions/admin/controller.tsx` — Sub-controller
- `packages/fetch-router/src/lib/controller.ts` — Controller type definition
