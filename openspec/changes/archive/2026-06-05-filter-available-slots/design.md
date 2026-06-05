## Context

The appointment system has two customer-facing booking surfaces:

1. **Graphical grid** (`/appointment`): Weekly calendar view where users click 15-min slots or drag appointment types. Client-side `computeBookableSlots` generates a `bookableByDay` map from offering data only — existing appointments are rendered as blocks but don't affect slot clickability.

2. **Wizard** (`/appointments/new`): Three-step form where users pick resource → day → time. `computeFullHourSlots` in the server-side controller generates available time slots from offerings only, without querying existing appointments.

In both cases, the exclusion constraint `no_overlapping_seats` on the `appointments` table provides a hard safety net. The change is purely a UX convenience — preventing customers from attempting to book already-taken slots.

## Goals / Non-Goals

**Goals:**
- Filter out booked 15-min sub-slots from the graphical grid's `bookableByDay` map
- Filter out booked full-hour slots from the wizard's step 3 dropdown
- Exclude the appointment being edited from the "booked" set (self-exclusion)
- Keep the DB exclusion constraint as the sole hard guarantee

**Non-Goals:**
- No schema changes, no new tables, no new columns
- No changes to offering management or resource management
- No changes to step 2 day picker (days with all slots filled still appear)
- No real-time SSE subscription for the wizard (race window is small, DB catches it)
- No changes to the admin appointments interface

## Decisions

### Decision 1: Two separate implementations (grid vs. wizard)

- **Graphical grid**: `computeBookableSlots` is a pure client-side function. Extend it to accept appointments array and exclude overlapping 15-min slots. The appointments data is already embedded in the JSON payload — no extra DB query needed.
- **Wizard**: Server-side controller loads data per request. Add a new DB query `getBookedRanges` in `appointofferings.ts`, then a pure JS filter `filterAvailableSlots`.

**Why not unify?** The contexts are fundamentally different — the grid works at 15-min granularity and has data client-side; the wizard works at 60-min granularity and computes on every server render. Unifying would add unnecessary complexity (e.g., serializing appointments into the wizard's JSON).

### Decision 2: Two simple SQL queries over one complex query

For the wizard: query offerings (existing) + query booked ranges (new), then subtract in JS.

**Why not a single SQL that generates available slots?** The `computeFullHourSlots` logic (handling disjoint offering ranges, ceil-based alignment) is well-tested pure JS. Porting it to SQL with `generate_series` and range containment checks for multiple disjoint offering ranges would produce ~20 lines of fragile SQL for no performance benefit (both queries hit `appointments_resource_date_idx`).

### Decision 3: Full-hour slots only for wizard

The wizard only shows slots where `start_min` is a multiple of 60. Appointments can have arbitrary durations (15-min minimum). The overlap check must account for this:

```
Slot at m is booked if ∃ appointment where m < appointment.end_min AND m+60 > appointment.start_min
```

This correctly handles partial overlaps (e.g., a 45-min appointment `[600,645)` blocks the 10:00 slot `[600,660)`).

### Decision 4: Self-exclusion via query parameter

For the wizard edit case, pass the editing appointment's ID to `getBookedRanges` as an exclusion parameter. For the grid, filter out the editing block's range from the appointments list passed to `computeBookableSlots`.

**Why not filter in JS?** Doing it at the query level is simpler and avoids loading the editing appointment into the booked set only to immediately remove it.

## Risks / Trade-offs

- **Stale data race window**: Between loading the page and submitting, another booking could take the slot. Risk: Low — the exclusion constraint catches it. Same as current behavior, just a smaller window (now: entire form fill; after: click-to-submit).

- **Grid performance**: `computeBookableSlots` loops over offerings + appointments. With 7 days × 24 slots × 15-min intervals = 672 grid slots and <100 appointments/week, this is negligible. Risk: None.

- **Wizard edit mode query**: Adds one extra `SELECT start_min, end_min FROM appointments WHERE resource_id=$1 AND date=$2 AND id!=$3`. Indexed on `(resource_id, date)`. Risk: None.

- **Non-full-hour appointments masking extra wizard slots**: A 15-min appointment from 10:00–10:15 blocks the full-hour slot 10:00–11:00. This is correct behavior — the slot is partially occupied.
