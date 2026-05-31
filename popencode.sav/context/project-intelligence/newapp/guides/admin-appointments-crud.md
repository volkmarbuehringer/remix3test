<!-- Context: project-intelligence/newapp/guides/admin-appointments-crud | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# Guide: Admin Appointments CRUD Grid

**Purpose**: Admin CRUD for `appointments` table — raw SQL grid with sortable columns, pagination, ILIKE search across title/user/resource, inline sidebar edit/create forms, exclusion constraint overlap detection, and FK constraint handling on delete.

---

## Architecture

```
/admin/appointments                      → Grid (full width)
/admin/appointments?editing=<id>         → 2-col: Grid | Edit Form (PUT)
/admin/appointments?creating=true        → 2-col: Grid | Create Form (POST)
GET    /admin/appointments        (index)   → Renders grid + optional sidebar
POST   /admin/appointments        (create)  → 302 → /admin/appointments?editing=<newId>
PUT    /admin/appointments/:id    (update)  → 302 → /admin/appointments
DELETE /admin/appointments/:id    (destroy) → 302 → /admin/appointments
GET    /admin/appointments/events (events)  → SSE stream via `appointmentChannel.subscribe(request)`
```

All actions protected by `requireAuth() + requireAdmin()` middleware. Uses raw SQL via `pool.query()`.

## Route Setup

**`app/routes.ts`** — Route definition under `adminRoutes`:

```tsx
appointments: route('appointments', {
  index: get('/'),
  create: post('/'),
  update: put('/:id'),
  destroy: del('/:id'),
}),
```

**`app/router.ts`** — Controller wiring:

```tsx
import adminAppointmentsController from './actions/admin-appointments-controller.tsx'
router.map(adminRoutes.admin.appointments, adminAppointmentsController)
```

**`app/ui/admin-layout.tsx`** — Nav entry under "Data" group:

```tsx
{ id: 'appointments', label: 'Appointments', route: routes.admin.appointments.index },
// + calendarSvg() icon in navIcon() switch
```

---

## Controller (`app/actions/admin-appointments-controller.tsx`)

### Index Action — Grid Query

Raw SQL with `LEFT JOIN users` and `LEFT JOIN resources`, parameterized `ORDER BY`/`LIMIT`/`OFFSET`, and text `ILIKE` filter across title, user name, and resource description:

```tsx
const PAGE_SIZE = 15
const SORTABLE_COLUMNS = [
  'a.id', 'a.title', 'u.name', 'r.description',
  'a.date', 'a.during',
  'a.created_at', 'a.updated_at',
] as const
const SEARCH_COLUMNS = ['a.title', 'u.name', 'r.description'] as const

async index(context) {
  let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = context.url.searchParams.get('filter') || undefined
  let { column, direction } = parseSort(context.url, {
    allowedColumns: SORTABLE_COLUMNS,
    defaultColumn: 'a.date',
    defaultDirection: 'asc',
  })

  let query = `
    SELECT a.id, a.title, a.user_id, u.name AS user_name,
           a.resource_id, r.description AS resource_description,
           a.date, a.during, a.created_at, a.updated_at
    FROM appointments a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN resources r ON r.id = a.resource_id
  `
  // + WHERE ILIKE on SEARCH_COLUMNS (title, user name, resource description)
  // + ORDER BY, LIMIT, OFFSET — all $N parameterized
  // +1 fetch for hasMore detection, rows.pop() if hasMore
}
```

The index action also:
- Loads all `resources` for sidebar dropdown (`SELECT id, description FROM resources ORDER BY description ASC`)
- Loads all `users` for sidebar dropdown (`SELECT id, name FROM users ORDER BY name ASC`)
- Checks `?editing=` param → fetches single appointment by ID with JOINs for edit form
- Checks `?creating=true` param → shows create form
- Renders via `renderAdminPage(context.render, 'appointments', <AdminAppointmentsPage .../>)`

### Create Action — Validation + INSERT

Zod form parsing via `remix/data-schema` + `remix/data-schema/form-data`:

```tsx
const appointmentSaveSchema = f.object({
  resource_id: f.field(s.string()),
  user_id: f.field(s.string()),
  title: f.field(s.string()),
  date: f.field(s.string()),
  start_min: f.field(s.string()),
  end_min: f.field(s.string()),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})
```

Validation (`validateAppointmentForm`):
- `resource_id`: must parse to non-NaN integer
- `user_id`: must parse to non-NaN integer
- `title`: non-empty after trim
- `date`: must match `/^\d{4}-\d{2}-\d{2}$/`
- `start_min`: integer 0–1380, divisible by 60 (hourly only)
- `end_min`: integer 60–1440, divisible by 60
- `end_min > start_min` (end must be after start)

On success:
1. Converts `date` (YYYY-MM-DD) to epoch ms: `new Date(parsed.date + 'T00:00:00Z').getTime()`
2. Computes `during = `[{startMin},{endMin})``
3. `INSERT ... RETURNING id` with `user_id, resource_id, title, date, during, created_at, updated_at`
4. 302-redirects to `?editing=<newId>` with preserved grid state

### Update Action — Same Validation + UPDATE

Same form schema and validation. Uses `context.params.id` for the target row. On success, 302-redirects to plain grid (preserving sort/filter/offset but clearing the edit sidebar).

### Destroy Action — DELETE

Deletes by `id`, checks `result.rowCount === 0` for 404. Grid state preserved via `formData.get()`. 302-redirects to grid.

### Exclusion Constraint Handling

PostgreSQL exclusion constraint `no_overlapping_seats` raises error code `23P01` when two appointments overlap for the same resource + date:

```tsx
function isExclusionConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; message?: string }
    return err.code === '23P01' || (err.message ?? '').includes('conflicts with key')
  }
  return false
}
```

Caught in `create` and `update` actions — 302-redirects back with `?creating=true` or `?editing=<id>` and an error message:
```tsx
backParams.set('error', 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.')
```

For the **create** action specifically, the redirect includes `?creating=true` so the form stays open with the user's inputs (the form doesn't repopulate — this is a limitation). For the **update** action, the redirect includes `?editing=<id>` to keep the sidebar open.

### FK Constraint Handling on Delete

When deleting an appointment that has dependent child records, PostgreSQL raises `23503`. The destroy action catches this and returns `409` with a German error message:

```tsx
if (err.code === '23503') {
  return Response.json(
    { ok: false, error: 'Dieser Termin kann nicht gelöscht werden, da noch Verweise darauf bestehen.' },
    { status: 409 },
  )
}
```

This prevents orphaned records when foreign keys reference the `appointments` table.

---

## Related

- [Admin Appointments UI](./admin-appointments-ui.md) — Grid page, forms, grid state
- [Admin Offerings CRUD Guide](./admin-offerings-crud.md) — Reference pattern (this was modeled after it)
- [Appointment Calendar Concept](../concepts/appointment-calendar.md) — Weekly calendar at `/appointment`
- [Exclusion Constraints](../concepts/exclusion-constraints.md) — `btree_gist` overlap prevention
- [Inline CRUD Pattern](./inline-crud-pattern.md) — Sidebar edit/create form details
- [Admin Filter Pattern](./admin-filter-pattern.md) — ILIKE filter on admin pages
- [Flat Controller Pattern](./flat-controller-pattern.md) — Per-route controller setup
- [PostgreSQL Range Types](../concepts/postgres-range-types.md) — `int4range` lifecycle hooks
- [Database Architecture](../concepts/database-architecture.md) — Table overview, BIGINT handling
- [Frame CRUD Pattern](./frame-crud-pattern.md) — Frame-based CRUD with inline sidebar
- [Raw SQL afterRead Bypass](../errors/raw-sql-bypasses-afterread.md) — pool.query() returns BIGINT as strings
