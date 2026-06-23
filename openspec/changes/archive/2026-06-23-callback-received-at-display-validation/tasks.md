## 1. Callback Duplicate Protection

- [x] 1.1 Add `WHERE callback_received_at IS NULL` to the callback UPDATE query in `app/actions/callback/controller.tsx`
- [x] 1.2 Return HTTP 404/409 Conflict when `rowCount === 0` (non-existent vs already received)
- [x] 1.3 Update callback controller tests in `app/actions/callback/controller.test.ts` to cover duplicate rejection

## 2. Display callback_received_at in Grid

- [x] 2.1 Add `callback_received_at` to `ORDER_BY_COLUMNS` in `app/actions/webhook-requests/controller.tsx`
- [x] 2.2 Add `callback_received_at` column to the table header in `app/ui/webhook-requests-page.tsx` between Status and Callback columns
- [x] 2.3 Add `callback_received_at` cell rendering with `fmtDate()` in the table body
- [x] 2.4 Update `colspan` on the empty state row from 6 to 7
