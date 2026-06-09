# Appointment Status Filter & Minimal Screen Fix

## What

Two UI improvements for the appointments feature:

1. **Add status filter to `/appointments/new`**: Add a past/pending (Ausstehend/Abgelaufen) segmented button group to the filter bar of the user's own appointments page, matching the existing pattern in `/verwaltung/appointments`.

2. **Fix minimal-screen button wrapping**: On narrow viewports the filter bar in `/appointments/new` wraps to 3 rows (5 period buttons overflow to 2 rows + spacer + "Neu" button falls to a 3rd row). After adding the status filter, this would become even worse. Restructure the layout so the filter bar fits in at most 2 rows on minimal screens.

## Why

- Users need to see both upcoming and past appointments from `/appointments/new` without switching to admin. The admin panel already has this filter — it's a missing parity feature.
- The 3-row wrapping on minimal screens looks broken and wastes vertical space. After adding status buttons (7 total + spacer + Neu), the wrapping would be unacceptable. Fixing the layout now prevents regression.

## Current State

### Status filter missing in `/appointments/new`

The `/verwaltung/appointments` admin page has a two-button "Ausstehend / Abgelaufen" filter group (`app/ui/admin-appointments-page.tsx:192-228`) driven by a `status` URL param (`'pending'` or `'expired'`). The controller (`app/actions/verwaltung/controller.tsx:956-966`) adds a `WHERE` clause filtering `a.date >= now()` (pending) or `a.date < now()` (expired).

The `/appointments/new` page (`app/actions/appointments-new/controller.tsx`) has no status filter — it shows all appointments for the current user regardless of date.

### Minimal screen wrapping

The filter bar (`app/ui/appointments-new-page.tsx:193-235`) uses `flexWrap: 'wrap'` on both the outer container and the inner span of 5 period buttons. On a narrow viewport the 5 period buttons wrap to 2 rows, then the spacer + "Neu" button become a 3rd row. Adding 2 status buttons would push this to 4 rows.

## Scope

- `app/actions/appointments-new/controller.tsx` — add `status` parameter to data loading + SQL filter
- `app/ui/appointments-new-page.tsx` — add status filter buttons to UI, restructure layout for max 2 rows
- `app/ui/mixins/admin-urls.ts` — no changes needed (shared URL builders already support `status`)
- Tests — update existing tests or add new ones
