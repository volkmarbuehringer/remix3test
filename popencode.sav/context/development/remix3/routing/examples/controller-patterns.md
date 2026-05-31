<!-- Context: development/remix3/examples/controller-patterns | Priority: high | Version: 2.0 | Updated: 2026-05-03 -->

# Controller Pattern Examples

## 1. Root Controller (Consolidated)

`my_app/app/actions/controller.tsx` — all top-level Route leaves consolidated with `assetServer` export.

```typescript
export default {
  actions: {
    async assets({ request }) { /* assetServer.fetch */ },
    home() { /* render home */ },
    authLogout() { /* clear session, redirect */ },
    async messagesContent({ url }) { /* paginated fragment */ },
    messagesSubscribe() { /* SSE stream */ },
  },
} satisfies Controller<typeof routes>
```

## 2. Sub-Controller with Middleware

`my_app/app/actions/messages/controller.tsx` — RouteMap with auth middleware.

```typescript
export default {
  middleware: [requireAuth()],
  actions: {
    async index() { /* GET /messages */ },
    async action({ get }) { /* POST /messages */ },
  },
} satisfies Controller<typeof routes.messages>
```

## 3. BuildAction for Leaves

`bookstore/app/actions/home.tsx` — standalone single Route leaf.

```typescript
export const home: BuildAction<'GET', typeof routes.home> = {
  async handler({ get }) { return render(<HomePage />) },
}
```

## 4. Auth with Nested Submaps

`bookstore/app/actions/auth/controller.tsx` — auth has login/register submaps, only logout leaf.

```typescript
export default {
  actions: {
    logout({ get }) {
      get(Session).unset('auth')
      return redirect(routes.home.href())
    },
  },
} satisfies Controller<typeof routes.auth>
```

## 5. Router.map() for Root

`my_app/app/router.ts` — single `router.map(routes, rootController)` for all root leaves.

```typescript
router.map(routes, rootController)
router.map(routes.messages, messagesController)  // RouteMaps get separate calls
```

## 6. Asset Server Module

`bookstore/app/actions/asset-server.ts` — shared module avoids circular import.

```typescript
export const assetServer = createAssetServer({
  basePath: '/assets', rootDir: path.resolve(import.meta.dirname, '../../..'),
  allow: ['bookstore/app/assets/**', 'bookstore/app/actions/**'],
})
```
