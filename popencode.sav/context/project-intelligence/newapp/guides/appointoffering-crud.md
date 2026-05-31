<!-- Context: project-intelligence/newapp/guides/appointoffering-crud | Priority: high | Version: 1.0 | Updated: 2026-05-25 -->

# Guide: AppointOffering CRUD Operations

**Purpose**: Server-side data access functions for querying appointments offerings — weekly range queries, day-specific lookups, slot bookability checks, and the `during` range string parser.

---

## 1. Table Schema

```tsx
export const appointofferings = table({
  name: 'appointoffering',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    day: c.bigint(),           // epoch ms of midnight (UTC)
    resource_id: c.integer(),
    during: c.text(),          // maps to int4range — string like "[480,1080)"
    created_at: c.bigint(),
    updated_at: c.bigint(),
  },
  // validate: resource_id, day, during all required
  // beforeWrite: only timestamps
  // afterRead: BIGINT conversion + during object→string normalization
})
```

Unlike `appointments`, `appointofferings` has **no computed columns** (`start_min`/`end_min`). The `during` range is the single source of time bounds. See [`appointoffering` concept](../concepts/appointoffering.md) for full schema details.

---

## 2. Data Functions

### `listOfferingsByWeek(db, weekStart, weekEnd, resourceId?)`

Weekly offerings query using `gte()` / `lt()` operators — identical pattern to `listAppointmentsByWeek`:

```tsx
import { gte, lt } from 'remix/data-table'

export async function listOfferingsByWeek(
  db: Database,
  weekStart: number,
  weekEnd: number,
  resourceId?: number,
): Promise<AppointOffering[]> {
  let query = db
    .query(appointofferings)
    .where(gte('day', weekStart))
    .where(lt('day', weekEnd))

  if (resourceId !== undefined) {
    query = query.where({ resource_id: resourceId })
  }

  return await query.orderBy('day', 'asc').orderBy('during', 'asc').all()
}
```

**Usage in controller (index action):**
```tsx
let offerings = await listOfferingsByWeek(context.db, mondayMs, nextMondayMs, selectedResourceId)
```

### `listOfferingsByDayAndResource(db, date, resourceId)`

Day-specific lookup used internally by `isSlotBookable()`:

```tsx
export async function listOfferingsByDayAndResource(
  db: Database,
  date: number,
  resourceId: number,
): Promise<AppointOffering[]> {
  return await db
    .query(appointofferings)
    .where({ day: date, resource_id: resourceId })
    .orderBy('during', 'asc')
    .all()
}
```

### `isSlotBookable(db, date, resourceId, startMin, endMin)`

Checks if a given time range is fully contained within at least one offering on that day + resource:

```tsx
export async function isSlotBookable(
  db: Database,
  date: number,
  resourceId: number,
  startMin: number,
  endMin: number,
): Promise<boolean> {
  let offerings = await listOfferingsByDayAndResource(db, date, resourceId)
  if (offerings.length === 0) return false

  for (let offering of offerings) {
    let parsed = parseDuring(offering.during)
    if (!parsed) {
      console.warn(`[appointofferings] Skipping offering ${offering.id}: unparseable during="${offering.during}"`)
      continue
    }
    if (startMin >= parsed.startMin && endMin <= parsed.endMin) {
      return true
    }
  }
  return false
}
```

**Logic:** The slot must be **fully contained** within an offering range. A slot from 9:00–10:00 is bookable only if there exists an offering where `offering.start_min <= 540 && offering.end_min >= 600`. Partial overlap is not sufficient.

### `parseDuring(during: string)`

Robust range string parser with fallback + warning logging:

```tsx
export function parseDuring(during: string): { startMin: number; endMin: number } | null {
  // Standard format: "[start,end)"
  let match = during.match(/^\[(\d+),(\d+)\)$/)
  if (match) {
    return { startMin: parseInt(match[1], 10), endMin: parseInt(match[2], 10) }
  }
  // Fallback: try to extract two numbers separated by comma
  let fallback = during.match(/\[(\d+)\s*,\s*(\d+)/)
  if (fallback) {
    return { startMin: parseInt(fallback[1], 10), endMin: parseInt(fallback[2], 10) }
  }
  return null
}
```

The `during` string format is `[lower,upper)` in PostgreSQL `int4range` convention. The fallback regex handles edge cases where the driver may return slightly different formatting.

**Used in:** Both `isSlotBookable()` (server-side) and `appointment-page.tsx` (normalizing offerings for client-side grid).

---

## 3. Controller Validation Flow

The controller (`appointment-controller.tsx`) validates against offerings in three paths:

| Action | When Validation Runs | Merges Existing? |
|--------|---------------------|------------------|
| Create (title) | After schema parse, before `createAppointment()` | N/A |
| Create (typeId) | After field checks, before raw SQL INSERT | N/A |
| Update | Only if slot is changing (date/time/resource present) | ✅ Yes — fetches existing appointment, merges sent + current fields |

**Update merge pattern:**
```tsx
// Only validate if slot is actually changing
let hasSlotChange =
  parsed.value.date !== undefined ||
  parsed.value.start_min !== undefined ||
  parsed.value.end_min !== undefined ||
  parsed.value.resource_id !== undefined

if (hasSlotChange) {
  let current = await context.db.findOne(appointments, {
    where: { id: appointmentId, user_id: userId },
  })
  // Merge: use sent value, fall back to current
  let mergedDate = parsed.value.date ?? Number(current.date)
  let mergedStartMin = parsed.value.start_min ?? (current.start_min as number)
  let mergedEndMin = parsed.value.end_min ?? (current.end_min as number)
  let mergedResourceId = parsed.value.resource_id ?? (current.resource_id as number)
  let bookable = await isSlotBookable(...)
  if (!bookable) return Response.json({ error: 'Slot is not bookable.' }, { status: 403 })
}
```

This prevents drag/resize from moving a block into a non-offering time while allowing pure rename (no slot change) to skip the validation.

---

## 4. Client-Side Offering Normalization

In `appointment-page.tsx`, offerings are pre-parsed before embedding in page JSON:

```tsx
let clientOfferings = offerings
  .map((o) => {
    let parsed = parseDuring(o.during)
    if (!parsed) {
      console.warn(`[appointment-page] Skipping corrupt offering ${o.id}: ...`)
      return null
    }
    return { day: o.day, start_min: parsed.startMin, end_min: parsed.endMin }
  })
  .filter((o): o is NonNullable<typeof o> => o !== null)
```

This produces a simple `{ day, start_min, end_min }[]` shape for the client. Unparseable offerings are filtered out with a warning — a zero-duration or corrupt offering would otherwise make the grid render incorrectly.

---

## 5. Error Handling

| Scenario | Where Caught | Status | Response |
|----------|-------------|--------|----------|
| Slot not in any offering | `isSlotBookable()` returns false | 403 | `{ error: 'Slot is not bookable.' }` |
| No offerings exist | `listOfferingsByDayAndResource` returns `[]` | 403 | `{ error: 'Slot is not bookable.' }` |
| Unparseable `during` | `parseDuring()` returns null in `isSlotBookable` | 403 (if no other offering matches) | Warning logged, other offerings checked |
| Unparseable `during` on client | `parseDuring()` returns null in page.tsx | — | Warning logged, offering excluded from client data |

The 403 response is distinct from the 409 collision status used by appointment overlap. This allows client-side `handleMutationResponse` to differentiate "not bookable" from "collision."

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/data/appointofferings.ts` | 1-81 | All 4 functions: listByWeek, listByDayAndResource, isSlotBookable, parseDuring |
| `app/data/schema.ts` | 454-509 | Table definition with lifecycle hooks |
| `app/actions/appointment-controller.tsx` | 18 | Import of `listOfferingsByWeek, isSlotBookable` |
| `app/actions/appointment-controller.tsx` | 120 | Index: `listOfferingsByWeek` call |
| `app/actions/appointment-controller.tsx` | 162-166 | Type-draw create: offering validation |
| `app/actions/appointment-controller.tsx` | 203-213 | Title create: offering validation |
| `app/actions/appointment-controller.tsx` | 259-275 | Update: merged-slot offering validation |
| `app/ui/appointment-page.tsx` | 40-49 | Client-side offering normalization via `parseDuring` |
| `app/ui/appointment-grid.tsx` | 39-46 | Client-side 403 handler in `handleMutationResponse` |

## Related

- [AppointOffering Concept](../concepts/appointoffering.md) — Architecture, schema, validation flow
- [Exclusion Constraints](../concepts/exclusion-constraints.md) — `btree_gist` overlap prevention
- [PostgreSQL Range Types](../concepts/postgres-range-types.md) — `int4range` lifecycle hooks
- [Appointment Calendar Architecture](../concepts/appointment-calendar.md) — Full calendar feature
- [Dynamic Grid Filtering](../../../development/remix3/ui/guides/dynamic-grid-filtering.md) — Offering-driven grid rendering
- [Appointment CRUD Guide](./appointment-crud.md) — Data layer for appointments
