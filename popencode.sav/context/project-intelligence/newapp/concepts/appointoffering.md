<!-- Context: project-intelligence/newapp/concepts/appointoffering | Priority: high | Version: 1.0 | Updated: 2026-05-25 -->

# Concept: AppointOffering — Resource Availability

**Core Idea**: The `appointoffering` table defines which time ranges on which days are bookable for each resource. The appointment grid renders only offering-covered slots; non-offering time ranges are visually distinct and rejected server-side with 403.

---

## Schema Overview

```tsx
export const appointofferings = table({
  name: 'appointoffering',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    day: c.bigint(),           // epoch ms of midnight (UTC)
    resource_id: c.integer(),
    during: c.text(),          // maps to int4range — see postgres-range-types.md
    created_at: c.bigint(),
    updated_at: c.bigint(),
  },
  // validate: resource_id, day, during all required
  // beforeWrite: timestamps only (no during conversion — unlike appointments)
  // afterRead: BIGINT normalization + during object-to-string conversion
})
```

**Key differences from `appointments`:**

| Aspect | appointments | appointofferings |
|--------|-------------|------------------|
| Computed columns (`start_min`, `end_min`) | ✅ from `during` | ❌ not computed |
| `beforeWrite` converts start/end → during | ✅ strips computed fields | ❌ during written directly |
| Overlap scope | Per resource + day | Per resource + day |
| Exclusion constraint | `no_overlapping_seats` | `no_overlapping_offerings` |

Since `appointoffering` has no computed columns, the `during` range is written directly as `[${start},${end})` in raw SQL during seeding (see `setup.ts`).

---

## How `during` (int4range) is Handled

The `during` column is `c.text()` in the schema definition, mapped to PostgreSQL `int4range`. The `afterRead` hook normalizes the driver's native object format back to a string:

```tsx
// afterRead in schema:
if (typeof value.during === 'object' && value.during !== null) {
  let r = value.during as { lower: unknown; upper: unknown }
  value.during = `[${r.lower},${r.upper})`
}
```

The `beforeWrite` hook for `appointofferings` only manages timestamps — unlike `appointments`, it does **not** convert `start_min`/`end_min` into a range string because offerings have no computed time columns. Raw SQL writes `during` as `int4range(480, 1080, '[)')` directly.

---

## Relationship to Appointments

- `appointofferings` define **per-resource, per-day** which time ranges are bookable
- `appointments` are actual bookings that must fall within an offering
- A single offering can contain multiple non-overlapping appointments (offerings define availability windows, not capacity)
- The appointment grid filters days/rows based on active offerings

---

## Server-Side Validation Flow

The controller (`appointment-controller.tsx`) validates **every create and update** against offerings using `isSlotBookable()`:

### Create Action (two paths)

**Path 1 — Manual title creation:**
1. Parse + validate body with schema
2. Check `end_min - start_min >= MINIMUM_DURATION` (15 min)
3. ✅ Call `isSlotBookable(db, date, resourceId, startMin, endMin)` — if false → 403
4. Call `createAppointment()`

**Path 2 — Type-drag (INSERT…SELECT):**
1. Validate typeId, date, start_min, resource_id presence
2. ✅ Call `isSlotBookable(db, date, resourceId, startMin, startMin + 15)` — if false → 403
3. Execute raw SQL INSERT…SELECT

### Update Action (drag/resize)

1. Parse + validate body
2. Determine if slot is changing (date, start_min, end_min, or resource_id present)
3. If slot changed:
   - Fetch existing appointment to resolve partial update
   - Merge sent fields with current values
   - ✅ Call `isSlotBookable()` with merged values — if false → 403
4. Call `updateAppointment()`

### Client-Side 403 Handling

In the appointment grid, `handleMutationResponse()` catches 403 and shows an alert:

```tsx
if (response.status === 403) {
  response.json().then((body) => {
    alert(body?.error || 'Slot ist nicht buchbar.')
  }).catch(() => {})
}
```

---

## GiST Exclusion Constraint

The `no_overlapping_offerings` constraint prevents two offerings from covering overlapping time ranges for the same resource on the same day:

```sql
CONSTRAINT no_overlapping_offerings EXCLUDE USING GIST (
  resource_id WITH =,    -- same resource
  day WITH =,            -- same day
  during WITH &&         -- overlapping time range
)
```

This ensures data integrity at the database level. See [Exclusion Constraints](./exclusion-constraints.md) for the full `btree_gist` pattern.

---

## Seed Data

When the database initializes with no offerings, it seeds Mon–Fri 8:00–18:00 for the current week's first resource:

```tsx
for (let i = 0; i < 5; i++) {
  let dayMs = mondayMs + i * 86_400_000
  await pool.query(
    `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
     VALUES ($1::bigint, $2, int4range(480, 1080, '[)'), $3, $3)`,
    [dayMs, firstResource.id, Date.now()],
  )
}
```

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/data/schema.ts` | 454-509 | `appointofferings` table definition |
| `app/data/setup.ts` | 156-172 | CREATE TABLE with exclusion constraint |
| `app/data/setup.ts` | 260-283 | Seed: Mon–Fri 8:00–18:00 for current week |
| `app/data/appointofferings.ts` | 57-81 | `isSlotBookable()` — server-side offering check |
| `app/actions/appointment-controller.tsx` | 162-166 | Type-drag path: offering validation → 403 |
| `app/actions/appointment-controller.tsx` | 203-213 | Create path: offering validation → 403 |
| `app/actions/appointment-controller.tsx` | 259-275 | Update path: merged-slot offering validation → 403 |
| `app/ui/appointment-grid.tsx` | 39-46 | Client-side 403 alert in `handleMutationResponse` |

## Related

- [Appointment Calendar Architecture](./appointment-calendar.md) — Full calendar feature architecture
- [Appointment CRUD Guide](../guides/appointment-crud.md) — Data layer operations for appointments
- [Exclusion Constraints](./exclusion-constraints.md) — `btree_gist` + overlap prevention pattern
- [PostgreSQL Range Types](./postgres-range-types.md) — `int4range` lifecycle hooks
- [AppointOffering CRUD Guide](../guides/appointoffering-crud.md) — Data access functions
- [Dynamic Grid Filtering](../../../development/remix3/ui/guides/dynamic-grid-filtering.md) — Client-side offering-driven grid rendering
