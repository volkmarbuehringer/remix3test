## Context

The admin appointments controller (`admin-appointments-controller.tsx`) handles CRUD at `/admin/appointments`. Currently, when creating or updating an appointment, it validates:
- Form fields (resource_id, user_id, title, date, start/end minutes)
- Past dates (via `isDateInPast()`)
- Overlapping appointments (via PostgreSQL exclusion constraint `23P01`)

Missing: it does **not** check whether the requested time range falls within an offering configured for that resource and day. The regular `/appointments` controller calls `isSlotBookable()` from `app/data/appointofferings.ts` for both create and update.

The `appointoffering` table stores concrete day/time slots generated from `offering_configs.rules`. These define when a resource is bookable (e.g., "Mondays 09:00–17:00"). The admin should respect these same boundaries.

## Goals / Non-Goals

**Goals:**
- Add `isSlotBookable()` check to the admin create action — reject if no offering exists for the time range
- Add `isSlotBookable()` check to the admin update action — reject if the changed slot has no offering (only check when date/resource/time changes)
- Add integration tests for offering-availability and collision scenarios

**Non-Goals:**
- No changes to the admin delete action (already handled correctly)
- No changes to the user-facing controller
- No changes to offering data model or `isSlotBookable()` function
- No rate limiting for admin (not needed — admin is trusted)
- No 24-hour modification window (admin bypass is intentional)

## Decisions

1. **Reuse `isSlotBookable()` directly**: The function from `app/data/appointofferings.ts` already accepts a `Database` parameter. The admin controller currently uses raw `pool.query()` instead of the data-layer's `Database` abstraction, so we need to pass `pool` as the `db` argument. The function's contract is compatible — it queries `appointoffering` by day+resource and checks containment.

2. **Check on update only when slot changes**: For updates, only call `isSlotBookable()` when at least one of `date`, `start_min`, `end_min`, or `resource_id` has changed. This avoids unnecessary queries when only the title or user_id is being modified. The admin controller's form always sends all fields (it's a full form submission), so the simplest approach is to always check on update (the function is fast — it queries a single indexed table).

3. **Return German error messages**: Consistent with the existing admin controller style. Use: "Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten." (The requested time range is outside booking hours.)

4. **Tests follow existing patterns**: The admin test file uses `router.fetch()` for integration tests with seed data. Use the existing `pool` query to find known offering slots for passing cases, and craft failing cases with times outside any offering.

## Risks / Trade-offs

- **[Risk] Admin might need to book outside offering hours**: Some admin workflows (emergencies, overrides) might legitimately need to bypass offering rules. Mitigation: if needed, a bypass flag could be added later. For now, the admin should follow the same business rules as users.
- **[Trade-off] Additional DB query on create/update**: `isSlotBookable()` does a `SELECT` on `appointoffering`. This is negligible — the table is small and indexed. The admin grid page already does several queries.
- **[Risk] No offerings seeded for certain resources**: If a resource has no offerings configured, all appointment creation will fail. This is correct behavior — if a resource has no bookable hours, no appointments should be made for it.
