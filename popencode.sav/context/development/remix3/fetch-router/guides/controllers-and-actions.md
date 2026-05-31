<!-- Context: development/remix3/fetch-router/guides/controllers-and-actions | Priority: high | Version: 1.0 -->

# Controllers and Actions

Group related route handlers into controllers. Use `router.map()` to register a controller (or single handler) against a route map. `createAction` and `createController` provide type safety.

## Key Points

- **Controller shape**: `{ middleware?: AnyMiddleware[], actions: Record<string, RequestHandler> }`. Controller middleware applies to all actions.
- **`router.map(routes, controller)`**: Registers an entire controller at once. Keys in `actions` must match route map keys.
- **`createAction(route, action)`**: Type-checks a handler against a specific route's params.
- **`createController(routes, controller)`**: Type-checks a controller's action keys against the route map keys.
- **Inline middleware**: `router.get('/admin', { middleware: [requireAdmin()], handler })` — per-action middleware.
- **Plain handler**: `router.get('/', (ctx) => new Response('Home'))` — no middleware, direct handler.

## Example

```ts
let usersCtrl = createController(users, {
  middleware: [requireAuth()],
  actions: {
    index(ctx) { return json(allUsers) },
    async create(ctx) {
      let data = await ctx.request.json()
      return json(newUser, { status: 201 })
    },
    show({ params }) { return json(findUser(params.id)) },
  },
})

router.map(users, usersCtrl)
// Registers GET /users → index, POST /users → create, GET /users/:id → show
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/controller.ts`
- Import: `import { createAction, createController } from 'remix/router'`

## Related

- [Resource Routes](resource-routes.md) — RESTful route maps for controllers
- [Middleware System](middleware.md) — Middleware levels and controller middleware
- [Route Maps](../concepts/route-maps.md) — Route map structure for `router.map()`
