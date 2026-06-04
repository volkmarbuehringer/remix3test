## Why

The admin appointments page (`/verwaltung/appointments`) currently lacks time-period filtering. Users must scroll through all appointments regardless of date range. The admin offerings page already has this capability with period filter buttons ("Diese Woche", "Nächste Woche", etc.), which gives admins a fast way to narrow results by time range. Adding the same pattern to appointments improves admin UX and consistency between admin pages.

## What Changes

- Add time-period filter buttons to the admin appointments page, matching the existing pattern on admin offerings
- Add `getPeriodRange()` logic to the admin appointments controller to convert period strings to SQL date range filters
- Update the admin appointments page UI to render period filter buttons in the toolbar
- Extend the admin appointments grid state to carry the `period` parameter through pagination, sorting, and form submissions

## Capabilities

### New Capabilities
- `appointments-time-filter`: Time-period filter buttons on the admin appointments page allowing admins to filter appointments by "Alle" (all), "Diese Woche" (this week), "Nächste Woche" (next week), "Diesen Monat" (this month), and "Nächsten Monat" (next month)

### Modified Capabilities
<!-- No existing capability requirements change. Implementation details only. -->

## Impact

- **Controller**: `app/actions/admin-appointments/controller.tsx` — add period parameter parsing and date-range SQL filtering
- **UI**: `app/ui/admin-appointments-page.tsx` — add filter buttons and URL builder helper
- **Grid state**: `app/utils/grid-state.ts` — already supports `period`; no schema changes needed
- **Form**: `app/ui/admin-appointments-form.tsx` — ensure period is carried through hidden form fields on create/edit submits
- **Routes**: No route changes needed; period is a query parameter
