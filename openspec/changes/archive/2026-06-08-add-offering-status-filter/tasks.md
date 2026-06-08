## 1. Controller

- [x] 1.1 Add `status` field to `OfferingPageData` interface in `app/actions/verwaltung/controller.tsx`
- [x] 1.2 Extend `loadOfferingPageData()` to read `status` from URL params, default to `'pending'`, add a `WHERE ao.day >=/< NOW()` SQL clause
- [x] 1.3 Update `renderOfferingsPage()` to pass `status` through to the page component props
- [x] 1.4 Add `status` to all error-path override objects in the `create` and `update` offerings actions (using `gridStateStatus(gridValues)`)

## 2. Page Component

- [x] 2.1 Add `status` to `AdminOfferingsPageProps` interface in `app/ui/admin-offerings-page.tsx`
- [x] 2.2 Add status button group (Ausstehend/Abgelaufen) to the filter bar, matching the appointments pattern
- [x] 2.3 Update all `buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, `buildEditUrl` calls to pass `status`
- [x] 2.4 Add `status` to JSON grid state and `GridStateHiddenInputs` state objects
- [x] 2.5 Pass `status` through to `AdminOfferingsEditPage`, `AdminOfferingsCreatePage`, and `AdminOfferingsConfigPage`

## 3. Side Panel Pages

- [x] 3.1 Add `status` prop to `AdminOfferingsEditPageProps` and pass through to `gridState`
- [x] 3.2 Add `status` prop to `AdminOfferingsCreatePageProps` and pass through to `gridState`
- [ ] 3.3 Add `status` prop to `AdminOfferingsConfigPageProps` and pass through to `gridState` (out of scope — config page is standalone, no grid state)
- [x] 3.4 Add `status` to cancel URL in the offerings form components

## 4. Tests

- [x] 4.1 Add test for default pending filter on offerings index
- [x] 4.2 Add test for `status=expired` query parameter
- [x] 4.3 Add test for `status` preservation across sort/pagination
