## 1. Server-Side Grace Period in Destroy Action

- [x] 1.1 Update the row-fetch query in `destroy` action to include `created_at`
- [x] 1.2 Modify the 24h guard condition to also check `Date.now() - Number(row.created_at) < 10 * 60 * 1000` — allow delete if within grace period

## 2. Data Loader blocked Flag

- [x] 2.1 Add `created_at` to the grid row query in `loadAppointmentsNewPageData`
- [x] 2.2 Update the `blocked` computation to account for the 10-minute grace period alongside the 24h start check
- [x] 2.3 Update the `deletingRow` fetch query to include `created_at` and compute `blocked` with grace period

## 3. Tests

- [x] 3.1 Add test for `DELETE` allowing deletion within 10-minute grace period (start < 24h, created < 10min ago)
- [x] 3.2 Verify admin can always delete regardless of grace period
- [x] 3.3 Verify existing delete tests still pass


## 4. Verification

- [x] 4.1 Run `npm test` — all 27 tests pass
- [x] 4.2 Run `npm run typecheck` — no type errors