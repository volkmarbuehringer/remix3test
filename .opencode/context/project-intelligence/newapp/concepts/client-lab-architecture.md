<!-- Context: project-intelligence/newapp/concepts/client-lab-architecture | Priority: high | Version: 1.2 | Updated: 2026-05-14 -->

# Concept: Client Lab Route Architecture

**Core Idea**: A standalone `/client` route with its own controller and `requireAuth()` middleware, demonstrating a server-rendered CRUD grid using Frame-based navigation, inline sidebar edit/create panels with `RestfulForm`, and RESTful API routes — minimal JavaScript (only DelButton for delete confirmation + Frame reload).

---

## Route Structure

```
/client                  (index)  →  Page shell with <Frame> + optional inline edit/create panel
/client?editing=42       (index)  →  Same page with inline edit sidebar for row 42
/client?creating=true    (index)  →  Same page with inline create sidebar
/client/grid             (grid)   →  Grid fragment (table, pagination, sort, filter, delete)
/client/edit/:rowId       (edit)   →  302 redirect to /client?editing=<rowId>
POST /client             (create) →  Creates new row, 302 redirect to /client
PUT /client/:id          (update) →  Updates row, 302 redirect to /client?editing=<id>
DELETE /client/:id       (destroy) → Deletes row, 302 redirect to /client
```

Route tree defined in `app/routes.ts`:

```ts
client: route('client', {
  index: get('/'),
  grid: get('/grid'),
  edit: get('/edit/:rowId'),
  create: post('/'),           // RESTful: POST to collection
  update: put('/:id'),         // RESTful: PUT to resource
  destroy: del('/:id'),        // RESTful: DELETE to resource
}),
```

## File Organization

```
app/actions/client/
  controller.tsx        →  createController with 5 actions (index, grid, edit, update, destroy, create)
  page.tsx              →  Page shell with <Frame> + optional sidebar (edit or create panel)
  grid-page.tsx         →  Grid fragment (table, sort headers, pagination, filter, delete, "+ Add New" link)
  edit-page.tsx         →  Inline edit form using RestfulForm method="PUT"
  create-page.tsx       →  Inline create form using RestfulForm method="POST"
  controller.test.ts    →  Integration tests
```

## Key Architecture Decisions

1. **Own controller** — The client lab has its own controller at `app/actions/client/controller.tsx`. This is the newapp pattern for nested routes needing their own actions (see [flat controller pattern](../guides/flat-controller-pattern.md)).

2. **No clientEntry (option 3)** — All interactivity is server-rendered. Grid navigation uses `<a>` links with `rmx-target="client-grid"` for Frame-based client-side replacement. CRUD uses `RestfulForm` POST/PUT/DELETE with 302 redirects.

3. **Inline sidebar CRUD** — Edit and create forms appear in a sticky sidebar panel alongside the grid, not as separate pages. Triggered by `?editing=` or `?creating=true` query params. The `page.tsx` component checks these props to render either `ClientEditPage` or `ClientCreatePage` in a 2-column grid layout.

4. **RESTful routes with RestfulForm** — Uses real HTTP verbs: `PUT /client/:id` for update, `DELETE /client/:id` for destroy, `POST /client` for create. The `RestfulForm` component wraps `<form>` to emit the correct method via hidden `_method` field, and `methodOverride()` middleware rewrites the request before routing.

5. **`edit` action is a 302 redirect** — `GET /client/edit/:rowId` does NOT render a page. It 302-redirects to `GET /client?editing=<rowId>`, which triggers the inline sidebar. This keeps the edit URL bookmarkable while centralizing rendering in `index`.

6. **Frame-based grid** — The page shell (`page.tsx`) renders a `<Frame>` loading `/client/grid` as a fragment. The grid action checks `X-Remix-Frame` header and renders either a bare fragment or a full `<Layout>` wrapper. See [frame CRUD pattern](../guides/frame-crud-pattern.md).

7. **URL as state** — Pagination offset, sort field, sort direction, and filter are all URL search params. Every action preserves them via hidden form fields (`_offset`, `_sort`, `_order`, `_filter`) or URL param forwarding.

8. **Validation via data-schema** — The `clientSaveSchema` uses `defaulted()` for every field allowing partial form submissions. Wrapped in try/catch for safety. Hidden grid-state fields (`_offset`, `_sort`, etc.) are included in the schema so they parse predictably.

9. **Auth-protected controller** — All client CRUD actions are protected by `middleware: [requireAuth()]`. Unauthenticated requests get 302 redirected to `/login`. Tests authenticate as seed user `user@newapp.com` via login POST to get a session cookie.

## Action Flow

| Action | Method | Returns | Description |
|--------|--------|---------|-------------|
| index | GET /client?offset=&sort=&order=&filter=&editing=&creating= | Full page with `<Frame>` + optional sidebar | Reads URL params, queries DB, checks for inline edit/create |
| grid | GET /client/grid?offset=&sort=&order=&filter= | Fragment (Frame) or full page | Same query as index, renders only grid content for Frame |
| edit | GET /client/edit/:rowId | 302 to /client?editing= | Redirects to index with inline edit mode |
| create | POST /client | 302 redirect to /client?editing= | Creates row via `db.create`, redirects with inline edit open |
| update | PUT /client/:id (via RestfulForm) | 302 redirect to /client?editing= | Updates row via `db.updateMany`, redirects with inline edit open |
| destroy | DELETE /client/:id (via RestfulForm in DelButton) | 302 redirect to /client | Deletes row via `db.delete`, preserves grid state |

## 📂 Codebase References

- **Route definition**: `app/routes.ts` — `routes.client` with RESTful verbs
- **Controller**: `app/actions/client/controller.tsx` — 6-action controller (index, grid, edit, create, update, destroy)
- **Page shell**: `app/actions/client/page.tsx` — 2-column grid layout with sidebar
- **Grid fragment**: `app/actions/client/grid-page.tsx` — Table + pagination + filter + DelButton
- **Inline edit form**: `app/actions/client/edit-page.tsx` — `RestfulForm method="PUT"`
- **Inline create form**: `app/actions/client/create-page.tsx` — `RestfulForm method="POST"`
- **RestfulForm**: `app/ui/restful-form.tsx` — RESTful HTML form component
- **Router wiring**: `app/router.ts` — `router.map(routes.client, clientController)`
- **Auth middleware**: `app/middleware/auth.ts` — `requireAuth()` used in controller
- **Tests**: `app/actions/client/controller.test.ts` — Authenticated via seed user login
- **Nav entry**: `app/ui/nav.ts` — `{ label: 'Client', href: '/client' }`
- **Frame name**: `app/routes.ts` — `frames.clientGrid = 'client-grid'`

## Related

- [Form Ergonomics](./form-ergonomics.md) — RestfulForm + methodOverride + data-schema
- [Inline CRUD Pattern](../guides/inline-crud-pattern.md) — Sidebar edit/create details
- [Frame CRUD Pattern](../guides/frame-crud-pattern.md) — Frame-based grid with form CRUD
- [Flat Controller Pattern](../guides/flat-controller-pattern.md) — Nested route controllers
- [Architecture Overview](./architecture.md) — Newapp general architecture
- [Pagination/Sort Utils](../lookup/pagination-sort-utils.md) — Utility functions
