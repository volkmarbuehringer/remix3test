<!-- Context: project-intelligence/newapp/guides/controller-pattern | Priority: high | Version: 1.1 | Updated: 2026-05-14 -->

# Guide: Controller Pattern

**Purpose**: Standard pattern for defining route actions using `createController` from `remix/fetch-router`.

---

## Signature

```ts
createController<RouteType, AppContext>(routeDefinition, {
  middleware?: Middleware[],     // Route-specific middleware
  actions: {
    [actionName](context): Response | Promise<Response>
  },
})
```

## Basic Pattern

```tsx
import { createController } from 'remix/fetch-router'
import { routes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'

export default createController<typeof routes.section, AppContext>(routes.section, {
  actions: {
    index(context) {
      return context.render(<Page />)
    },
    async action(context) {
      let { db, formData } = context
      let data = s.parse(schema, formData)
      await db.create(table, data)
      return redirect('/')
    },
  },
})
```

## Middleware Per Controller

Use the `middleware` array for route-level guards:

```tsx
export default createController<typeof routes.admin, AppContext>(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index(context) {
      return renderAdminPage(context.render, 'dashboard', <Content />)
    },
  },
})
```

**Rules:**
- Global middleware (auth, db, session) goes in `router.ts` stack
- Route-level middleware (requireAuth, requireAdmin) goes in controller
- Order inside controller array matters (auth before admin check)

## Destructuring Pattern

You can destructure context properties at the parameter level:

```tsx
// Full destructuring
async action({ db, formData, render, params }) {
  return render(<Page data={await db.find(...)} />)
}

// Partial — only what you need
index({ render }) { return render(<Page />) }
```

## Route to Controller Mapping

`app/router.ts` maps route trees to controllers. See [router.ts](../app/router.ts) for the full wiring:

```tsx
router.map(routes, controller)                          // Top-level
router.map(listsRoutes, listsController)                 // Auth-protected
router.map(routes.client, clientController)              // Auth-protected CRUD
router.map(adminRoutes.admin, adminController)           // requireAuth+requireAdmin
```

## Patterns

| Pattern | When | Example |
|---------|------|---------|
| **Single controller** | Flat routes, few actions | `app/actions/controller.tsx` — home, assets, ui |
| **Flat controller** | Nested route with own actions | `app/actions/client/controller.tsx` — 6-action CRUD |
| **Own middleware** | Route needs guard | `app/actions/lists-controller.tsx` — requireAuth |
| **Standalone action** | Single POST handler | `app/actions/auth-logout.tsx` — logout only |

## Form Handling & Validation

Controllers that accept form data use `data-schema` for parsing. See [form ergonomics](../concepts/form-ergonomics.md) for the three patterns (strict/guarded/lenient):

```ts
// Define schema at module scope
const saveSchema = f.object({
  name: f.field(s.defaulted(s.string(), '')),
})

// Parse in action — try/catch for lenient schemas
async create(context) {
  try { let parsed = s.parse(saveSchema, context.formData) } catch {
    return Response.json({ error: 'Invalid data' }, { status: 400 })
  }
}
```

For PUT/DELETE from HTML forms, pair `RestfulForm` (UI) with `methodOverride()` (middleware). The `edit` action in inline CRUD is a 302 redirect, not a page render:

```tsx
async edit(context) {  // 302 to /client?editing=<id>
  return new Response(null, { status: 302, headers: { Location } })
}
```

See [inline CRUD pattern](./inline-crud-pattern.md).

## 📂 Codebase References

- **Top-level**: `app/actions/controller.tsx` — Home, assets, UI showcase
- **Auth-protected**: `app/actions/lists-controller.tsx` (requireAuth), `app/actions/client/controller.tsx` (requireAuth CRUD), `app/actions/admin-controller.tsx` (requireAuth+Admin)
- **Auth controllers**: `app/actions/auth-login-controller.tsx` (completeAuth), `app/actions/auth-logout.tsx` (regenerateId), `app/actions/auth-register-controller.tsx`
- **Messages**: `app/actions/admin-messages-controller.tsx` — SSE + CRUD
- **Router mapping**: `app/router.ts` — All route-to-controller wiring
- **Form components**: `app/ui/restful-form.tsx`, `app/actions/client/edit-page.tsx`, `app/actions/client/create-page.tsx`

## Related

- [Form Ergonomics](../concepts/form-ergonomics.md) — RestfulForm + methodOverride + validation
- [Inline CRUD Pattern](./inline-crud-pattern.md) — Sidebar edit/create in CRUD
- [Flat Controller Pattern](./flat-controller-pattern.md) — Nested route controllers
- [Middleware Chain](../concepts/middleware-chain.md) — Global vs route middleware
- [Context Access Patterns](../concepts/context-access-patterns.md) — Using context properties
- [Frame CRUD Pattern](./frame-crud-pattern.md) — Grid CRUD with pagination
