<!-- Context: project-intelligence/newapp/guides/admin-offerings-crud | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# Guide: Admin Offerings CRUD Grid

**Purpose**: Admin CRUD for `appointoffering` table — raw SQL grid with sortable columns, pagination, text filter, inline sidebar edit/create forms, and exclusion constraint conflict detection (409).

---

## Architecture

```
/admin/offerings                      → Grid (full width)
/admin/offerings?editing=<id>         → 2-col: Grid | Edit Form (PUT)
/admin/offerings?creating=true        → 2-col: Grid | Create Form (POST)
GET    /admin/offerings        (index)   → Renders grid + optional sidebar
POST   /admin/offerings        (create)  → 302 → /admin/offerings?editing=<newId>
PUT    /admin/offerings/:id    (update)  → 302 → /admin/offerings
DELETE /admin/offerings/:id    (destroy) → 302 → /admin/offerings
```

All actions protected by `requireAuth() + requireAdmin()` middleware. Uses raw SQL via `pool.query()` (no ORM data-table).

## Route Setup

**`app/routes.ts`** — Route definition under `adminRoutes`:

```tsx
offerings: route('offerings', {
  index: get('/'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
}),
```

**`app/router.ts`** — Controller wiring:

```tsx
import adminOfferingsController from './actions/admin-offerings-controller.tsx'
router.map(adminRoutes.admin.offerings, adminOfferingsController)
```

**`app/ui/admin-layout.tsx`** — Nav entry under "Data" group:

```tsx
{ id: 'offerings', label: 'Offerings', route: routes.admin.offerings.index },
```

---

## Controller (`app/actions/admin-offerings-controller.tsx`)

### Index Action — Grid Query

Raw SQL with `LEFT JOIN resources`, parameterized `ORDER BY`/`LIMIT`/`OFFSET`, and text `ILIKE` filter on `r.description`:

```tsx
const PAGE_SIZE = 15
const SORTABLE_COLUMNS = [
  'ao.id', 'ao.day', 'ao.resource_id',
  'r.description', 'ao.during',
  'ao.created_at', 'ao.updated_at',
] as const
const SEARCH_COLUMNS = ['r.description'] as const

async index(context) {
  let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = context.url.searchParams.get('filter') || undefined
  let { column, direction } = parseSort(context.url, {
    allowedColumns: SORTABLE_COLUMNS,
    defaultColumn: 'ao.day',
    defaultDirection: 'asc',
  })

  let query = `
    SELECT ao.id, ao.day, ao.resource_id, r.description AS resource_description,
           ao.during, ao.created_at, ao.updated_at
    FROM appointoffering ao
    LEFT JOIN resources r ON r.id = ao.resource_id
  `
  // + WHERE ILIKE, ORDER BY, LIMIT, OFFSET — all $N parameterized
  // +1 fetch for hasMore detection, rows.pop() if hasMore
```

The index action also:
- Loads all `resources` for the sidebar dropdown (`SELECT id, description FROM resources ORDER BY description ASC`)
- Checks `?editing=` param → fetches single offering by ID for edit form
- Checks `?creating=true` param → shows create form
- Renders via `renderAdminPage(context.render, 'offerings', <AdminOfferingsPage .../>)`

### Create Action — Validation + INSERT

Zod form parsing via `remix/data-schema` + `remix/data-schema/form-data`:

```tsx
const offeringSaveSchema = f.object({
  resource_id: f.field(s.string()),
  day: f.field(s.string()),
  start_min: f.field(s.string()),
  end_min: f.field(s.string()),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})
```

Validation (`validateOfferingForm`):
- `resource_id`: must parse to non-NaN integer
- `day`: must match `/^\d{4}-\d{2}-\d{2}$/`
- `start_min`: integer 0–1380, divisible by 60 (hourly only)
- `end_min`: integer 60–1440, divisible by 60
- `end_min > start_min` (end must be after start)

On success, computes `during = `[${startMin},${endMin})``, inserts with `RETURNING id`, 302-redirects to `?editing=<newId>` with preserved grid state.

### Update Action — Same Validation + UPDATE

Same form schema and validation. Uses `context.params.id` for the target row. On success, 302-redirects to plain grid (preserving sort/filter/offset but clearing the edit sidebar).

### Destroy Action — DELETE

Deletes by `id`, checks `result.rowCount === 0` for 404. Grid state preserved via `formData.get()`. 302-redirects to grid.

### Exclusion Constraint Handling

PostgreSQL exclusion constraint `no_overlapping_offerings` raises error code `23P01` when two offerings overlap for the same resource + day:

```tsx
function isExclusionConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; message?: string }
    return err.code === '23P01' || (err.message ?? '').includes('conflicts with key')
  }
  return false
}
```

Caught in `create` and `update` actions — returns `409` with German error message:
```tsx
// Status 409:
{ ok: false, error: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.' }
```

Other errors are re-thrown (not swallowed).

---

## Related

- [Admin Offerings UI](./admin-offerings-ui.md) — Grid page, forms, grid state
- [AppointOffering Concept](../concepts/appointoffering.md) — Schema, exclusion constraint, validation flow
- [AppointOffering CRUD Guide](./appointoffering-crud.md) — Data access functions (listByWeek, isSlotBookable)
- [Exclusion Constraints](../concepts/exclusion-constraints.md) — `btree_gist` overlap prevention
- [Frame CRUD Pattern](./frame-crud-pattern.md) — Frame-based CRUD with inline sidebar
- [Inline CRUD Pattern](./inline-crud-pattern.md) — Sidebar edit/create form details
- [Admin Filter Pattern](./admin-filter-pattern.md) — ILIKE filter on admin pages
- [Flat Controller Pattern](./flat-controller-pattern.md) — Per-route controller setup
- [PostgreSQL Range Types](../concepts/postgres-range-types.md) — `int4range` lifecycle hooks
- [Database Architecture](../concepts/database-architecture.md) — Table overview, BIGINT handling
