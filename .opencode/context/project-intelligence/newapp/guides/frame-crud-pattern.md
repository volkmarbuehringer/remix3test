<!-- Context: project-intelligence/newapp/guides/frame-crud-pattern | Priority: high | Version: 1.1 | Updated: 2026-05-14 -->

# Guide: Frame-Based CRUD Grid with Inline Sidebar Forms

**Purpose**: Server-rendered CRUD grid using `<Frame>` for navigation, inline sidebar edit/create panels with `RestfulForm`, and RESTful HTTP methods — minimal JavaScript (DelButton only).

---

## Architecture

```
/client (index)            → Layout with <Frame> + optional sidebar
/client?editing=42         → 2-col grid: <Frame> | <ClientEditPage method="PUT">
/client?creating=true      → 2-col grid: <Frame> | <ClientCreatePage method="POST">
/client/grid (fragment)    → Grid: "+Add New", filter, sortable table, pagination, DelButton
POST   /client                  (create)  → 302 to /client?editing=<id>
PUT    /client/:id              (update)  → 302 to /client?editing=<id>
DELETE /client/:id              (destroy) → 302 to /client
GET    /client/edit/:rowId      (edit)    → 302 to /client?editing=<rowId>
```

## Components

### Page Shell (`page.tsx`)

Checks `editRow` / `creating` props to show either full-width grid or 2-column layout with sticky sidebar:

```tsx
let hasSidebar = editRow || creating
if (hasSidebar) {
  return (
    <div style="display:grid;grid-template-columns:1fr 380px;gap:24px">
      <Frame name={frames.clientGrid} src={frameSrc} />
      <div style="position:sticky;top:1.5rem">
        {editRow ? <ClientEditPage ... /> : <ClientCreatePage ... />}
      </div>
    </div>
  )
}
return <Frame name={frames.clientGrid} src={frameSrc} />
```

### Grid Fragment (`grid-page.tsx`)

The grid action checks `X-Remix-Frame` for fragment mode. Always use `fragmentResponseInit()` when returning a Frame fragment to prevent stale caching via `Cache-Control: no-store`:

```tsx
async grid(context) {
  let isFrame = context.request.headers.get('X-Remix-Frame') === 'true'
  let gridContent = <ClientGridPage rows={page} ... />
  if (isFrame) {
    return context.render(gridContent, fragmentResponseInit())
  }
  return context.render(<Layout title="Client Lab">{gridContent}</Layout>)
}
```

### Inline Edit/Create Forms (`edit-page.tsx`, `create-page.tsx`)

Both use `RestfulForm` with hidden state fields (`_offset`, `_sort`, `_order`, `_filter`). Edit uses `method="PUT"` (renders as POST + hidden `_method=PUT`), create uses `method="POST"`. See [inline CRUD pattern](./inline-crud-pattern.md).

## Navigation Patterns

### Frame Navigation (`rmx-target`)

Sort headers and pagination links use `rmx-target="client-grid"`. The Frame system intercepts clicks, fetches the grid fragment via `resolveFrame`, and replaces Frame content without full page load:

```tsx
<a href={buildSortUrl('name', sortField, sortOrder, offset, filter)}
   rmx-target="client-grid">Name <span>{sortArrow(...)}</span></a>
```

### Page-Level Navigation (`rmx-document`)

"+ Add New", "Edit", and "Clear filter" use `rmx-document` or `target="_top"` — these change the URL params controlling the sidebar, triggering a full page transition.

### Sort & Pagination

Sort toggles direction on same-field click, resets to asc on field change. Offset resets to 0 on sort change. Pagination is offset-based (20 rows/page), uses `paginate()` which fetches `pageSize + 1` rows for `hasMore` detection. Links disable at boundaries.

### Filter

`<form method="GET" action="/client">` — full page load. Filter param propagates to all sort/pagination URLs.

### Delete (DelButton — clientEntry)

The only clientEntry in the CRUD. Intercepts form submit via `on('submit')`:

1. Shows `confirm()` dialog
2. If confirmed, `fetch()` with `redirect: 'manual'` and `_method=DELETE`
3. Calls `handle.frame?.reload()` to refresh grid

Server deletes and 302s — `redirect: 'manual'` prevents browser from following it.

### State Preservation

Every action preserves grid state via hidden form fields (`_offset`, `_sort`, `_order`, `_filter`) or query params in links. These flow through the full cycle: grid → edit/create form → save → redirect back.

## Key Conventions

- **Minimal clientEntry** — only DelButton uses JS (confirm dialog + Frame reload); all other interactions are server round-trips
- **URL state only** — no React state, no client-side data
- **Native HTML selects** — `<select>` with `input.base`/`input.focus` mixins (not `remix/ui/select`)
- **`fragmentResponseInit()`** — always use for Frame fragments to prevent caching
- **RestfulForm + methodOverride** — RESTful verbs from HTML forms via hidden `_method` field
- **Inline sidebar** — edit/create in a sticky right panel, not separate pages

## 📂 Codebase References

- **Page shell**: `app/actions/client/page.tsx` — Sidebar + Frame layout
- **Grid fragment**: `app/actions/client/grid-page.tsx` — Table, sort, pagination, filter, DelButton
- **Inline edit form**: `app/actions/client/edit-page.tsx` — `RestfulForm method="PUT"`
- **Inline create form**: `app/actions/client/create-page.tsx` — `RestfulForm method="POST"`
- **Controller**: `app/actions/client/controller.tsx` — 6 actions (index, grid, edit, create, update, destroy)
- **RestfulForm**: `app/ui/restful-form.tsx` — RESTful HTML form component
- **DelButton**: `app/assets/client-del-button.tsx` — Delete button clientEntry
- **fragmentResponseInit**: `app/middleware/render.tsx` — Cache-Control helper
- **Frame name**: `app/routes.ts` — `frames.clientGrid = 'client-grid'`

## Related

- [Inline CRUD Pattern](./inline-crud-pattern.md) — Sidebar edit/create details
- [Client Lab Architecture](../concepts/client-lab-architecture.md) — Route structure
- [Form Ergonomics](../concepts/form-ergonomics.md) — RestfulForm + methodOverride + validation
- [Flat Controller Pattern](./flat-controller-pattern.md) — Route controller setup
- [Pagination/Sort Utils](../lookup/pagination-sort-utils.md) — `paginate()` and `parseSort()` APIs
