<!-- Context: project-intelligence/newapp/examples/controller-example | Priority: high | Version: 1.1 | Updated: 2026-05-28 -->

# Example: Controller with Context Property Access

**Purpose**: Minimal controller showing all three context access patterns for actions, including the dual HTML/JSON renderer pattern.

---

## Full Controller

```tsx
import { createController } from 'remix/fetch-router'
import { routes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'

export default createController<typeof routes, AppContext>(routes, {
  actions: {
    // GET — render a page (HTML via Remix UI)
    index(context) {
      return context.render(<HomePage />)
    },

    // POST — use db + formData directly
    async create(context) {
      let { db, formData } = context
      let data = parseForm(formData)
      await db.create(table, data)
      return redirect('/')
    },

    // GET — JSON API response (no HTML rendering)
    async list(context) {
      let items = await context.db.findAll('items')
      return context.json({ items })
    },

    // GET — use url params
    show(context) {
      let id = context.params.id
      let page = context.url.searchParams.get('page')
      return context.render(<Detail id={id} page={Number(page)} />)
    },

    // POST — return JSON error response
    async validate(context) {
      let { json, formData } = context
      let data = parseForm(formData)
      if (!data.name) {
        return json({ error: 'Name is required' }, { status: 400 })
      }
      // ...
    },

    // GET — destructure at parameter level
    edit({ render, params }) {
      return render(<EditPage id={params.id} />)
    },
  },
})
```

## Explanation

1. **`context.render(node)`** — Renders Remix UI nodes (HTML). Installed by `render()` middleware.
2. **`context.json(data, init?)`** — Returns JSON responses. Installed by `json()` middleware. Use `unknown` for data (not `any`), so callers must be intentional.
3. **`context.db`** — Direct database access (installed by `loadDatabase()` middleware)
4. **`context.formData`** — Parsed form body (installed by `formData()` middleware)
5. **`context.params`** — Route parameters from URL pattern
6. **`context.url`** — `URL` object with `searchParams`, `pathname`, etc.
7. **Destructuring** — `{ render, json, db }` works because `AppContext` resolves all properties

## 📂 Codebase References

- **Real example**: `app/actions/admin-messages-controller.tsx` — Shows db, formData, params, render, url
- **JSON API example**: `app/actions/admin-nutzer-controller.tsx` — Heavy `context.json()` usage for JSON endpoints
- **Simple example**: `app/actions/controller.tsx` — render + params only
- **Auth example**: `app/actions/auth-login-controller.tsx` — session, formData, render, url

## Related

- [Controller Pattern](../guides/controller-pattern.md) — Full pattern documentation
- [Context Access Patterns](../concepts/context-access-patterns.md) — When to use each
- [Middleware Chain](../concepts/middleware-chain.md) — What installs each property
