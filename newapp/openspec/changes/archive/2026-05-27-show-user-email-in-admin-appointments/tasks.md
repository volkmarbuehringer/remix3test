## 1. Controller Changes

- [x] 1.1 Replace `u.name AS user_name` with `u.email AS user_email` in the index SQL query and edit row SQL query in `admin-appointments-controller.tsx`
- [x] 1.2 Update `AppointmentRow` interface: replace `user_name: string | null` with `user_email: string | null`
- [x] 1.3 Update `SORTABLE_COLUMNS`: replace `'u.name'` with `'u.email'`
- [x] 1.4 Update `SEARCH_COLUMNS`: replace `'u.name'` with `'u.email'`
- [x] 1.5 Change `LEFT JOIN users u ON u.id = a.user_id` to `INNER JOIN users u ON u.id = a.user_id` in both the index and edit row SQL queries

## 2. UI Changes

- [x] 2.1 Update column header text from "Benutzer" to "E-Mail" in `admin-appointments-page.tsx`
- [x] 2.2 Update sort link from `'u.name'` to `'u.email'` for the email column in `admin-appointments-page.tsx`
- [x] 2.3 Update cell rendering to display `row.user_email` instead of `row.user_name` in the table body
