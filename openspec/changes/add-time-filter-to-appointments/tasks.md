## 1. Controller: Add period filtering logic

- [x] 1.1 Add `getPeriodRange()` function to `app/actions/admin-appointments/controller.tsx` (copy from admin-offerings controller, lines 94–126)
- [x] 1.2 Add `period` to `AppointmentPageData` interface and to `loadAppointmentPageData` function signature (overrides parameter)
- [x] 1.3 Extract `period` from `context.url.searchParams` in `loadAppointmentPageData`
- [x] 1.4 Add `period` SQL WHERE clause in `loadAppointmentPageData` query builder, after the text filter block, following the same pattern as admin-offerings (lines 192–205)
- [x] 1.5 Include `period` in the return value of `loadAppointmentPageData`
- [x] 1.6 Pass `period` prop to `<AdminAppointmentsPage>` in `renderAppointmentsPage`
- [x] 1.7 In all mutation action handlers (create, update, destroy), extract grid state with `gridStateFromFormData` and pass `gridStatePeriod(gridValues)` as `period` to `loadAppointmentPageData` calls

## 2. UI: Add period to page props and type

- [x] 2.1 Add `period` prop (string | undefined) to `AdminAppointmentsPageProps` interface in `app/ui/admin-appointments-page.tsx`
- [x] 2.2 Destructure `period` from `handle.props` in the component function

## 3. UI: Add time filter buttons to admin appointments page

- [x] 3.1 Add `buildPeriodUrl` helper function to `app/ui/admin-appointments-page.tsx` (similar to admin-offerings-page.tsx lines 72–80)
- [x] 3.2 Add the period filter segmented button control inside the toolbar `<form>`, between the search button and the "Neu" create button, matching the admin-offerings layout (lines 170–202)
- [x] 3.3 Pass `period` to all `buildSortUrl`, `buildPaginationUrl`, and `buildCreateUrl` calls in the page component (12 call sites)
- [x] 3.4 Add `period` to `AdminAppointmentsEditPageProps` interface in `app/ui/admin-appointments-edit-page.tsx`
- [x] 3.5 Pass `period` prop from `AdminAppointmentsEditPage` to `AdminAppointmentsForm` gridState
- [x] 3.6 In the controller's `renderAppointmentsPage`, pass `period` to `<AdminAppointmentsEditPage>` when rendering edit mode

## 4. Verify

- [x] 4.1 Run typecheck (`npm run typecheck`) to catch any type errors
- [x] 4.2 Run tests (`npm test`) to verify no regressions
- [x] 4.3 Run the dev server and manually verify the filter buttons appear, are clickable, and correctly filter appointments by period
- [x] 4.4 Verify period is preserved across sort, pagination, create, and edit operations
