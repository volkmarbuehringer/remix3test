## 1. Route & Controller

- [x] 1.1 Add `report1: get('/report1')` to the verwaltung route map in `app/routes.ts`
- [x] 1.2 Add `verwaltungReport1` export in `app/actions/verwaltung/controller.tsx` with requireAuth + requireAdmin middleware
- [x] 1.3 Wire `routes.verwaltung.report1` to `verwaltungReport1` in `app/router.ts`

## 2. SQL Query

- [x] 2.1 Implement the SQL query in the report1 action: group by user with COUNT, MIN(date), MAX(date), SUM(end_min - start_min), with dynamic WHERE for year/month range, optional user_id, and text filter
- [x] 2.2 Add sorting via `parseSort` with allowed columns: `name`, `count`, `min_date`, `max_date`, `total_hours`, `avg_hours`
- [x] 2.3 Add pagination with LIMIT/OFFSET and hasMore detection (page size 20)

## 3. UI Page

- [x] 3.1 Create `app/ui/admin-report1-page.tsx` with the report table component
- [x] 3.2 Add year picker, month picker, user dropdown, and filter input to the page header
- [x] 3.3 Add sortable column headers, pagination controls, and hidden grid state fields
- [x] 3.4 Render via `renderVerwaltungPage()` in the controller

## 4. Nav Link

- [x] 4.1 Add "Auswertung" nav item under the Verwaltung section in `app/ui/nav.ts`
