<!-- Context: bookstore-demo/guides | Priority: high | Version: 1.0 | Updated: 2026-04-26 -->

# Admin Lists Route Pattern

**Core Idea**: SSR admin route showing database records in a table with JSON preview and delete action. Demonstrates nested route structure, JSONB data storage, and programmatic delete via form POST.

---

## Key Points

- **Nested route structure**: `controllers/admin/lists/controller.tsx` + `index-page.tsx`
- **Schema already exists**: `lists` table with `list` JSON column
- **Controller exports default**: Object with `actions.index()` and `actions.delete()`
- **Page receives props**: Data passed from controller via render function
- **Delete via POST**: Form posts to `/:listId` route with `_action` hidden field
- **Redirect after delete**: Returns `redirect()` to refresh the list

---

## Quick Example

```
controllers/admin/lists/
├── controller.tsx      # SSR controller with index + delete actions
└── index-page.tsx     # Page component with table UI
```

```tsx
// controller.tsx
import type { Controller } from 'remix/fetch-router'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { lists as listsTable } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { render } from '../../../utils/render.tsx'
import { AdminListsIndexPage } from './index-page.tsx'

export default {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let allLists = await db.findMany(listsTable, {
        orderBy: [['id', 'desc']] as never,
      })
      return render(<AdminListsIndexPage lists={allLists} total={allLists.length} />)
    },

    async delete({ get, params }) {
      let db = get(Database)
      let listId = Number(params.listId)
      let targetList = await db.find(listsTable, listId)
      if (targetList) {
        await db.delete(listsTable, targetList.id)
      }
      return redirect(routes.admin.lists.index.href())
    },
  },
} satisfies Controller<typeof routes.admin.lists>
```

```tsx
// index-page.tsx
import type { List } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function AdminListsIndexPage() {
  return ({ lists, total }: { lists: List[]; total: number }) => (
    <Layout>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Created</th>
            <th>List Data (JSON)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((list) => (
            <tr key={list.id}>
              <td>{list.id}</td>
              <td>{new Date(Number(list.created_at)).toLocaleString()}</td>
              <td>
                <pre>{JSON.stringify(list.list, null, 2)}</pre>
              </td>
              <td>
                <form method="POST" action={routes.admin.lists.delete.href({ listId: list.id })}>
                  <input type="hidden" name="_action" value="destroy" />
                  <button type="submit">Delete</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  )
}
```

---

## Route Definition

```ts
// app/routes.ts
export const routes = route('admin', {
  // ...other routes...
  lists: route('lists', {
    index: get('/'),
    delete: post('/:listId'),
  }),
})
```

---

## How It Works

### 1. index Action

- Fetches all records from `lists` table via `db.findMany()`
- Orders by `id desc` to show newest first
- Passes data to page component via `render()`

### 2. delete Action

- Extracts `listId` from URL params
- Finds record by ID, deletes it
- Returns `redirect()` to refresh the page

### 3. Delete Form

- POSTs to `routes.admin.lists.delete.href({ listId: list.id })`
- Includes `_action` hidden field for semantics
- Redirects after successful delete

### 4. JSON Preview

- Uses `<pre>` with `JSON.stringify(value, null, 2)` for formatted output
- Sets `whiteSpace: 'pre-wrap'` for readability
- Limits `maxHeight` for large JSON

---

## Schema Reference

```ts
// app/data/schema.ts
export const lists = table({
  name: 'lists',
  columns: {
    id: c.integer(),
    list: c.text(),        // JSON stored as text
    created_at: c.bigint(),
    updated_at: c.bigint(),
  },
  afterRead({ value }) {
    if (typeof value.list === 'string') {
      value.list = JSON.parse(value.list)
    }
  },
})
```

---

## Codebase References

**Implementation**:
- `bookstore/app/routes.ts` - Route definitions (lines 121-124)
- `bookstore/app/controllers/admin/lists/controller.tsx` - Controller with index/delete
- `bookstore/app/controllers/admin/lists/index-page.tsx` - Table UI with JSON preview
- `bookstore/app/data/schema.ts` - Lists table schema (lines 380-392)
- `bookstore/app/controllers/admin/page.tsx` - Dashboard with Lists link (lines 50-56)

---

## Related Patterns

- [admin-chatlog-routes.md](../guides/admin-chatlog-routes.md) - Similar admin route pattern with filter
- [jsonb-database-patterns.md](../concepts/jsonb-database-patterns.md) - JSONB storage patterns
- [admin-books-fsp.md](../lookup/admin-books-fsp.md) - Filter/sort/pagination for admin tables