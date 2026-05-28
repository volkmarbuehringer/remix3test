## Why

The admin appointment edit form at `/admin/appointments` uses hourly-only time dropdowns (`START_MIN_OPTIONS = [0, 60, 120, ..., 1380]`, `END_MIN_OPTIONS = [60, 120, ..., 1440]`), but appointments created via the `/appointment` calendar use 15-minute granularity (draft defaults to 15 min, resize snaps to 15-min boundaries). When a non-hourly time value like `495` (08:15) doesn't match any dropdown option, no `<option>` is marked `selected`, and the browser defaults to the first option (`00:00` or `01:00`). This silently corrupts the appointment time on save.

The grid display is unaffected because it renders from the `int4range` `during` column directly via `formatDuring()`, which correctly handles any minute value.

## What Changes

- Switch the admin appointment edit and create form time dropdowns from 24 hourly options to 96 fifteen-minute options (`[0, 15, 30, ..., 1425]` for start, `[15, 30, ..., 1440]` for end)
- Update the server-side validation in `validateAppointmentForm()` to accept 15-minute granularity (divisible by 15 instead of 60)
- No database schema changes — `start_min`/`end_min` computed columns from `int4range` already store any minute value natively

## Capabilities

### New Capabilities

*(None — this is a bug fix, not a new capability.)*

### Modified Capabilities

*(No existing specs require changes — this is purely an implementation-level fix to the admin form UI and validation.)*

## Impact

| File | Change |
|------|--------|
| `app/ui/admin-appointments-edit-page.tsx` | Change `START_MIN_OPTIONS` and `END_MIN_OPTIONS` from hourly to 15-min intervals |
| `app/ui/admin-appointments-create-page.tsx` | Same dropdown change if it uses similar constants (check if shared) |
| `app/actions/admin-appointments-controller.tsx` | Update `validateAppointmentForm()` to accept `% 15 === 0` instead of `% 60 === 0` |
| `app/ui/admin-appointments-page.tsx` | None — display uses `formatDuring()` which already handles any granularity |
