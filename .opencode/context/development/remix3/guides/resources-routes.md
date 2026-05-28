<!-- Context: development/remix3/guides/resources-routes | Priority: medium | Version: 1.0 | Updated: 2026-05-07 -->

# Resources Route Pattern

**Purpose**: Auto-generated CRUD routes using `resources()` from `remix/fetch-router`, extracted from the bookstore demo.

## Core Pattern

`resources()` generates a full set of CRUD routes (index, show, create, edit, update, destroy) for a resource:

```typescript
import { route, resources } from 'remix/fetch-router'

export const routes = {
  admin: route('admin', {
    books: resources('books', { param: 'bookId' }),
    users: resources('users', { only: ['index', 'show', 'edit', 'update', 'destroy'] }),
    orders: resources('orders', { param: 'orderId', except: ['create'] }),
  }),
}
```

This generates:

| Resource | Routes created |
|----------|----------------|
| `books` | `/admin/books` (index), `/admin/books/new` (create), `/admin/books/:bookId` (show), `/admin/books/:bookId/edit` (edit), `/admin/books/:bookId` (update via PUT/DELETE), `/admin/books/:bookId` (destroy via DELETE) |
| `users` | Same as books, minus `create` (and `/new` route) |
| `orders` | Same as books, minus `new` route |

## Options

| Option | Type | Description |
|--------|------|-------------|
| `param` | `string` | URL parameter name for the resource ID (default: `'id'`) |
| `only` | `string[]` | Limit to specific actions: `'index'`, `'show'`, `'create'`, `'edit'`, `'update'`, `'destroy'` |
| `except` | `string[]` | Exclude specific actions from the full set |

## Controller Structure

The controller for a resource route handles all actions via its `actions` object:

```typescript
// app/controllers/admin/books/controller.tsx
export default {
  actions: {
    async index({ get, url }) {
      let db = get(Database)
      let books = await db.findMany(books, { orderBy: ['id', 'asc'], limit: 20 })
      return render(<BookList books={books} />)
    },

    async show({ get, params }) {
      let db = get(Database)
      let book = await db.find(books, params.bookId)
      if (!book) throw new Response('Not found', { status: 404 })
      return render(<BookDetail book={book} />)
    },

    async create({ get }) {
      return render(<BookForm />)
    },

    async edit({ get, params }) {
      let db = get(Database)
      let book = await db.find(books, params.bookId)
      if (!book) throw new Response('Not found', { status: 404 })
      return render(<BookForm book={book} />)
    },

    async update({ get, params, url }) {
      let db = get(Database)
      let formData = get(FormData)
      // ... validate and update ...
      return redirect(routes.admin.books.index.href())
    },

    async destroy({ get, params }) {
      let db = get(Database)
      await db.delete(books, params.bookId)
      return redirect(routes.admin.books.index.href())
    },
  },
} satisfies Controller<typeof routes.admin.books>
```

**Tip**: Type your controller with `Controller<typeof routes.resourceName>` to get fully-typed params and action matching.

## Route Type References

After defining resources, access route URLs via the generated route map:

```typescript
// Index
routes.admin.books.index.href()
// => '/admin/books'

// Show
routes.admin.books.show.href({ bookId: 'b_001' })
// => '/admin/books/b_001'

// New (create form)
routes.admin.books.new.href()
// => '/admin/books/new'

// Edit
routes.admin.books.edit.href({ bookId: 'b_001' })
// => '/admin/books/b_001/edit'
```

## Related

- `middleware/guides/middleware-composition.md` — Route-level middleware for admin auth
- `data/guides/data-table-crud.md` — CRUD operations for resource handlers
- `data/guides/data-table-schema.md` — Table schema with lifecycle hooks
- `guides/demo-patterns.md` — Controller action anatomy in bookstore demo

## Codebase References

- `demos/bookstore/app/routes.ts` — Full `resources()` usage with admin books, users, orders
- `demos/bookstore/app/controllers/admin/books/controller.tsx` — Resource controller with all 6 actions
- `demos/bookstore/app/controllers/admin/users/controller.tsx` — Resource controller with filtered actions
- `packages/fetch-router/README.md` — `resources()` API documentation
