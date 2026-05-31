<!-- Context: project-intelligence/newapp/guides/appointment-crud-controller | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# Guide: Appointment CRUD Controller

**Purpose**: Data layer functions, validation schemas, and controller actions for the customer-facing appointment API.

---

## 1. Data Layer Functions

### Types

```tsx
interface AppointmentInput  { title: string; date: number; start_min: number; end_min: number }
interface AppointmentUpdate { title?: string; date?: number; start_min?: number; end_min?: number }
```

### Create
`db.create(appointments, data, { returnRow: true })` — Always sets `user_id` server-side. Trims `title`.

### Update
`findOne` check → `db.update(appointments, { id }, partialUpdate)` — Only includes provided fields. Supports rename-only requests.

### Delete
`findOne` check → `db.query(appointments).where(...).delete()` — Meaningful 404 rather than silent no-op.

## 2. Validation Schemas

Uses `s.parseSafe()` (returns `{ success, value }` — never throws):

```tsx
const createSchema = s.object({
  title: s.string().pipe(minLength(1), maxLength(80)),
  date: s.number(), start_min: s.number(), end_min: s.number(),
})
const updateSchema = s.object({
  title: s.optional(s.string().pipe(minLength(1), maxLength(80))),
  date: s.optional(s.number()),
  start_min: s.optional(s.number()),
  end_min: s.optional(s.number()),
})
```

| Action | Schema | On Error | On Success |
|--------|--------|----------|------------|
| POST | All required | `400 { error }` or `400 { error, code: 'collision' }` | `201 { appointment }` |
| PUT | All optional | `400 { error }` or `404 { error }` | `200 { appointment }` |
| DEL | No body | `404 { error }` | `200 { deleted: true }` |

### Minimum Duration

Enforced at the controller level after schema parsing: `end_min - start_min >= MINIMUM_DURATION` (15 min).

### Type-Drag Creation (Raw SQL)

Uses `INSERT ... SELECT` with hardcoded `+ 15` for the during range — type-drag appointments always start at 15 minutes.

## 3. Controller Pattern

Actions read JSON body, validate, call data function, return JSON:

```tsx
async create(context) {
  let userId = (context.auth!.identity as User).id
  let body = await context.request.json()
  let parsed = s.parseSafe(createSchema, body)
  if (!parsed.success) return Response.json({ error: 'Validation failed.' }, { status: 400 })
  let appointment = await createAppointment(context.db, userId, parsed.value)
  return Response.json({ appointment }, { status: 201 })
}
```

Errors follow catch-or-rethrow — `AppointmentError` is caught and returned as JSON; others propagate to middleware.

## Related

- [Appointment Schema & Queries](./appointment-schema-queries.md) — Table schema, week queries, ownership
- [PostgreSQL Range Types](../concepts/postgres-range-types.md) — `int4range` lifecycle hooks
- [Known Issues](../lookup/known-issues.md) — Raw SQL BIGINT strings
