<!-- Context: project-intelligence/newapp/examples/controller-example | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# Example: Controller with Context Property Access

**Purpose**: Minimal controller showing all three context access patterns for actions.

---

## Full Controller

```tsx
import { createController } from 'remix/fetch-router'
import { routes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'

export default createController<typeof routes, AppContext>(routes, {
  actions: {
    // GET — render a page
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

    // GET — use url params
    show(context) {
      let id = context.params.id
      let page = context.url.searchParams.get('page')
      return context.render(<Detail id={id} page={Number(page)} />)
    },

    // GET — destructure at parameter level
    edit({ render, params }) {
      return render(<EditPage id={params.id} />)
    },
  },
})
```

## Explanation

1. **`context.render(node)`** — Replaces old `context.get(Renderer)` pattern
2. **`context.db`** — Direct database access (installed by `loadDatabase()` middleware)
3. **`context.formData`** — Parsed form body (installed by `formData()` middleware)
4. **`context.params`** — Route parameters from URL pattern
5. **`context.url`** — `URL` object with `searchParams`, `pathname`, etc.
6. **Destructuring** — `{ render, db }` works because `AppContext` resolves all properties

## 📂 Codebase References

- **Real example**: `app/actions/admin-messages-controller.tsx` — Shows db, formData, params, render, url
- **Simple example**: `app/actions/controller.tsx` — render + params only
- **Auth example**: `app/actions/auth-login-controller.tsx` — session, formData, render, url

## Related

- [Controller Pattern](../guides/controller-pattern.md) — Full pattern documentation
- [Context Access Patterns](../concepts/context-access-patterns.md) — When to use each
- [Middleware Chain](../concepts/middleware-chain.md) — What installs each property
