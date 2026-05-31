<!-- Context: project-intelligence/newapp/guides/appointment-schema-queries | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# Guide: Appointment Schema & Queries

**Purpose**: Database schema, week-range queries, and ownership isolation for the `appointments` table.

---

## 1. Table Schema

```tsx
export const appointments = table({
  name: 'appointments',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    title: c.text(),
    date: c.bigint(),           // epoch ms of midnight (UTC)
    created_at: c.bigint(),
    updated_at: c.bigint(),
    during: c.text(),           // maps to int4range
    start_min: c.integer(),     // GENERATED ALWAYS AS (lower(during)) STORED
    end_min: c.integer(),       // GENERATED ALWAYS AS (upper(during)) STORED
  },
  // validate: start_min/end_min both-or-neither, start < end, bounds 0-1440
  // beforeWrite: converts pair to "[start,end)" range string, strips computed fields
  // afterRead: normalizes BIGINT strings + int4range driver objects
})
```

**Key:** `date` is epoch ms of midnight UTC. `start_min`/`end_min` are computed columns — they appear in SELECT results but cannot be written directly.

## 2. Week Range Query

```tsx
import { gte, lt } from 'remix/data-table'

async function listAppointmentsByWeek(db, userId, weekStart, weekEnd) {
  return await db
    .query(appointments)
    .where({ user_id: userId })
    .where(gte('date', weekStart))
    .where(lt('date', weekEnd))
    .orderBy('date', 'asc')
    .orderBy('start_min', 'asc')
    .all()
}
```

**Why `lt` not `lte`?** A row with `date` equal to `weekEnd` would be incorrectly included. `lt` gives exactly one week.

## 3. Ownership Isolation

Every data function receives `userId` and includes `user_id` in all queries:

```tsx
let existing = await db.findOne(appointments, {
  where: { id: appointmentId, user_id: userId },
})
if (!existing) throw new AppointmentError('Appointment not found.', 404)
```

Custom `AppointmentError` carries an HTTP `status` field for consistent JSON error responses.

## Related

- [Appointment CRUD Controller](./appointment-crud-controller.md) — Validation, controller actions, CSRF
- [PostgreSQL Range Types](../concepts/postgres-range-types.md) — `int4range` lifecycle hooks
- [Database Architecture](../concepts/database-architecture.md) — Table overview, BIGINT handling
