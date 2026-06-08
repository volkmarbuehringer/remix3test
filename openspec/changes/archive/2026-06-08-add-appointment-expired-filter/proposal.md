## Why

The appointments admin page currently shows all appointments regardless of their status. For daily operations, administrators need a quick way to focus on pending (future) appointments and optionally review expired (past) ones. Adding a radio toggle makes this workflow efficient and reduces visual noise.

## What Changes

- Add a radio button group to the appointments filter bar with two options: "Ausstehend" (pending) and "Abgelaufen" (expired)
- Pending is the default filter — when no explicit `status` param is set, only future/active appointments are shown
- The SQL query gains a `WHERE` clause on `a.date` based on the selected status
- The `status` query parameter is preserved across pagination, sorting, period filter, search, and grid state (like `period`)
- The `AppointmentPageData` interface gains a `status` field (`'pending' | 'expired' | undefined`)

## Capabilities

### New Capabilities
- `appointment-status-filter`: Server-side status filter (pending/expired) for the appointment admin list, with URL-preserved state across navigation actions

### Modified Capabilities
<!-- No existing spec-level capabilities are changing — this is purely additive -->

## Impact

- **Controller** (`app/actions/verwaltung/controller.tsx`): Extend `AppointmentPageData`, `loadAppointmentPageData()` SQL query, and `renderAppointmentsPage()` to handle the `status` query parameter
- **Page component** (`app/ui/admin-appointments-page.tsx`): Add radio button group to the filter bar; update `buildPeriodUrl`, `buildSortUrl`, `buildPaginationUrl`, and `buildCreateUrl` to carry `status` param; update `GridStateHiddenInputs` and JSON grid state
- **Edit/Create pages**: `GridStateHiddenInputs` in edit/create forms need to include `status`
- **URL helpers** (`app/ui/mixins/admin-urls.ts`): May need a small update if `status` should be a standard param
