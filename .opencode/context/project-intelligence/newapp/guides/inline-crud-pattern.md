<!-- Context: project-intelligence/newapp/guides/inline-crud-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-14 -->

# Guide: Inline Sidebar CRUD Pattern

**Purpose**: Edit and create records in a sticky sidebar panel alongside the grid — no separate pages, no JavaScript modals, all server-rendered HTML forms.

---

## Architecture

```
/client?editing=42          →  Grid (left) + Edit Form (right sidebar)
/client?creating=true       →  Grid (left) + Create Form (right sidebar)
/client                     →  Grid only (full width)
```

The `page.tsx` component checks `editRow` and `creating` props to decide layout:

```tsx
// page.tsx
let hasSidebar = editRow || creating

if (hasSidebar) {
  return (
    <div style="display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start">
      <Frame name={frames.clientGrid} src={frameSrc} />
      <div style="position:sticky;top:1.5rem">
        {editRow ? <ClientEditPage ... /> : <ClientCreatePage ... />}
      </div>
    </div>
  )
}
// Full width — grid only
return (
  <div style="max-width:960px;margin:0 auto">
    <Frame name={frames.clientGrid} src={frameSrc} />
  </div>
)
```

## Triggering the Sidebar

### Edit
- **From grid**: "Edit" button links to `/client?editing=<rowId>&offset=...&sort=...&order=...&filter=...`
- **From URL**: `GET /client/edit/:rowId` 302-redirects to `GET /client?editing=<rowId>`
- **After save**: `PUT /client/:id` 302-redirects back to `GET /client?editing=<id>` (keeps sidebar open)

### Create
- **From grid**: "+ Add New" button links to `/client?creating=true&sort=...&order=...`
- **After create**: `POST /client` 302-redirects to `GET /client?editing=<newRowId>` (opens edit for the new record)

### Cancel
- Both edit and create forms include a Cancel button that links to `/client` with preserved grid state (offset, sort, order, filter) but WITHOUT the editing/creating param — closes the sidebar.

## Controller Logic

The `index` action checks URL params before rendering:

```tsx
async index(context) {
  let { db, url, render } = context
  // ... query, paginate, parseSort ...

  // Check for inline edit
  let editingParam = url.searchParams.get('editing')
  let editRow = null
  if (editingParam && Number.isFinite(Number(editingParam))) {
    editRow = await db.find(clients, { id: Number(editingParam) })
  }

  // Check for inline create
  let creating = url.searchParams.get('creating') === 'true'

  return render(
    <Layout title="Client">
      <ClientPage
        frameSrc={frameSrc}
        editRow={editRow}
        creating={creating}
        editingOffset={String(offset)}
        editingSort={column}
        editingOrder={direction}
        editingFilter={filter}
      />
    </Layout>,
  )
}
```

## State Preservation

Every form and link carries hidden fields or query params for grid state:

| State | Form Field | Query Param |
|-------|-----------|-------------|
| Pagination offset | `_offset` | `offset` |
| Sort column | `_sort` | `sort` |
| Sort direction | `_order` | `order` |
| Filter text | `_filter` | `filter` |

These flow through the full cycle: grid → edit/create form → save → redirect back to grid.

## Form Method Conventions

| Operation | Component | Method | Action |
|-----------|-----------|--------|--------|
| Create | `RestfulForm method="POST"` | POST | `/client` |
| Update | `RestfulForm method="PUT"` | PUT | `/client/:id` |
| Delete | `DelButton` (clientEntry, fetch + Frame reload) | DELETE | `/client/:id` |

Delete uses `DelButton` — a clientEntry that intercepts form submit, shows a confirm dialog, then uses `fetch()` with `redirect: 'manual'` and calls `handle.frame?.reload()` to refresh the grid without a full page load.

## 📂 Codebase References

- **Page shell**: `app/actions/client/page.tsx` — Sidebar layout logic
- **Controller**: `app/actions/client/controller.tsx` — `index` action with edit/create params
- **Edit form**: `app/actions/client/edit-page.tsx` — `RestfulForm method="PUT"`
- **Create form**: `app/actions/client/create-page.tsx` — `RestfulForm method="POST"`  
- **Grid fragment**: `app/actions/client/grid-page.tsx` — Edit/Create URL builders
- **RestfulForm**: `app/ui/restful-form.tsx` — RESTful form wrapper

## Related

- [Frame CRUD Pattern](./frame-crud-pattern.md) — Grid frame navigation
- [Client Lab Architecture](../concepts/client-lab-architecture.md) — Route structure
- [Form Ergonomics](../concepts/form-ergonomics.md) — RestfulForm + methodOverride
- [Flat Controller Pattern](./flat-controller-pattern.md) — Controller setup
