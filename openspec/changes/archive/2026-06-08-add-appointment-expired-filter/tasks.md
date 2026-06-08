## 1. Grid State &amp; URL Helpers

- [x] 1.1 Add `status` field to `GridState` interface in `app/utils/grid-state.ts` and update all `gridState*()` functions to read/write it
- [x] 1.2 Add `status` parameter to `buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, `buildEditUrl`, `buildCancelUrl` in `app/ui/mixins/admin-urls.ts`
- [x] 1.3 Add `status` hidden input to `GridStateHiddenInputs` in `app/ui/grid-state-hidden.tsx`

## 2. Controller

- [x] 2.1 Add `status` field to `AppointmentPageData` interface in `app/actions/verwaltung/controller.tsx`
- [x] 2.2 Extend `loadAppointmentPageData()` to read `status` from URL params, default to `'pending'`, and add a `WHERE a.date >=/< NOW()` SQL clause based on the value
- [x] 2.3 Update `renderAppointmentsPage()` to pass `status` through to the page component props

## 3. Page Component (UI)

- [x] 3.1 Add radio button group (two `<input type="radio">`) to the filter bar in `admin-appointments-page.tsx` between the period buttons and the "Neu" button
- [x] 3.2 Wire radio buttons to submit the GET form on change
- [x] 3.3 Add `status` to `buildPeriodUrl`, JSON grid state, and `GridStateHiddenInputs` props in the page component

## 4. Edit &amp; Create Side Panels

- [x] 4.1 Add `status` prop to `AdminAppointmentsEditPageProps` and pass it through to `gridState`
- [x] 4.2 Add `status` prop to `AdminAppointmentsCreatePageProps` and pass it through to `gridState`

## 5. Tests

- [x] 5.1 Update existing appointment index test to verify default pending filter
- [x] 5.2 Add test for `status=expired` query parameter
- [x] 5.3 Add test for `status` preservation across sort/pagination/period/search
