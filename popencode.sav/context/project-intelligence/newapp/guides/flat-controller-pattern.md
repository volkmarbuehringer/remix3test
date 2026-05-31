<!-- Context: project-intelligence/newapp/guides/flat-controller-pattern | Priority: high | Version: 1.1 | Updated: 2026-05-14 -->

# Guide: Flat Controller Pattern

**Purpose**: How to create a nested route with its own controller in newapp, following the client lab pattern.

---

## When to Use

The main `app/actions/controller.tsx` handles simple public routes (home, assets, ui). Create a separate "flat controller" when your route needs:

- Multiple related sub-routes (CRUD: index, grid, edit, save, destroy)
- Route-specific auth middleware (`requireAuth()`) or guards (`requireAdmin()`)
- Its own page components that shouldn't clutter `app/ui/`
- A focused set of actions that don't belong in the main controller

## Step-by-Step

### 1. Define the route tree

In `app/routes.ts`, add a nested route using the `route()` helper:

```ts
export const routes = route({
  // ... existing routes ...

  // New nested route (using RESTful verbs)
  myFeature: route('my-feature', {
    index: get('/'),
    detail: get('/:id'),
    create: post('/'),           // POST to collection
    update: put('/:id'),         // PUT to resource
    destroy: del('/:id'),        // DELETE to resource
  }),
})
```

### 2. Create the controller

Create `app/actions/<route-key>/controller.tsx`:

```ts
import { createController } from 'remix/fetch-router'
import { Renderer } from 'remix/render-middleware'
import { getContext } from 'remix/async-context-middleware'

import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'

export default createController<typeof routes.myFeature, AppContext>(
  routes.myFeature,
  {
    actions: {
      async index({ get, url }) {
        let render = get(Renderer)!
        return render(/* page content */)
      },
      // ... more actions
    },
  },
)
```

The generic parameter `<typeof routes.myFeature, AppContext>` gives you type-safe params and action matching.

### 3. Wire the router

In `app/router.ts`, add:

```ts
import myFeatureController from './actions/my-feature/controller.tsx'

// ... after existing routes
router.map(routes.myFeature, myFeatureController)
```

### 4. Add page components alongside

Create page components in `app/actions/<route-key>/` (not `app/ui/`):

```
app/actions/my-feature/
  controller.tsx    →  createController
  page.tsx          →  Page shell
  index-page.tsx    →  Index content
  detail-page.tsx   →  Detail view
  edit-page.tsx     →  Edit form (uses RestfulForm method="PUT")
  create-page.tsx   →  Create form (uses RestfulForm method="POST")
  controller.test.ts    →  Integration tests
```

This colocation keeps route-specific components with their controller. Move shared UI to `app/ui/` only when another route needs it.

Forms that need PUT/DELETE from HTML use `RestfulForm` with `methodOverride()` middleware. See [form ergonomics](../concepts/form-ergonomics.md).

### 5. Add nav entry

In `app/ui/nav.ts`, add an item to `NAV_SECTIONS`:

```ts
{ label: 'My Feature', href: '/my-feature' }
```

## Pattern: Action Composition

Each action receives `{ get, url, params, request }`. Access middleware via `getContext()`:

```ts
async index({ get, url }) {
  let db = getContext().get(Database)!
  let render = get(Renderer)!
  // ...
}
```

## Key Differences from Main Controller

| Aspect | Main Controller (`controller.tsx`) | Flat Controller (`actions/*/controller.tsx`) |
|--------|-----------------------------------|----------------------------------------------|
| Location | `app/actions/controller.tsx` | `app/actions/<route>/controller.tsx` |
| Page components | In `app/ui/` | Colocated in `app/actions/<route>/` |
| Route scope | Top-level routes | Nested route tree |
| Type param | `typeof routes` | `typeof routes.myFeature` |
| Example uses | home, /ui | /client (auth CRUD), lists (auth routes), admin |

## 📂 Codebase References

- **Client controller**: `app/actions/client/controller.tsx` — Reference CRUD (6 actions + requireAuth)
- **Lists controller**: `app/actions/lists-controller.tsx` — Simple auth-protected routes
- **Route definition**: `app/routes.ts` — `routes.client` with RESTful verbs, `listsRoutes` separate tree
- **Router wiring**: `app/router.ts` — `router.map(routes.client, clientController)`, `router.map(listsRoutes, listsController)`
- **Page components**: `app/actions/client/page.tsx`, `grid-page.tsx`, `edit-page.tsx`, `create-page.tsx`
- **RestfulForm**: `app/ui/restful-form.tsx` — Used in edit/create forms for PUT/POST
- **Main controller**: `app/actions/controller.tsx` — Single controller pattern for comparison
- **newapp AGENTS.md**: `/newapp/AGENTS.md` — Route ownership conventions

## Related

- [Form Ergonomics](../concepts/form-ergonomics.md) — RestfulForm + methodOverride + validation
- [Inline CRUD Pattern](./inline-crud-pattern.md) — Sidebar edit/create in CRUD
- [Client Lab Architecture](../concepts/client-lab-architecture.md) — Route architecture
- [Frame CRUD Pattern](./frame-crud-pattern.md) — Using this pattern for frame-based grids
- [Page Primitives](./page-primitives.md) — Shared UI components
