## Why

The current `/verwaltung/users-pdf` route exports ALL users regardless of appointment activity. Admins need the ability to export a filtered user list — only those who have appointments within a selected time range — for targeted reporting, auditing, and external submission.

## What Changes

- Add new route `/verwaltung/users-export` with a filter form for time range selection
- Filter form with start date and end date pickers
- PDF export only includes users who have at least one appointment within the selected time range
- Dashboard card in `/verwaltung` linking to the new export page
- Same admin-only access and PDF output format as the existing `users-pdf` route

## Capabilities

### New Capabilities

- `filtered-user-export`: Export users filtered by appointment date range as PDF

### Modified Capabilities

<!-- No existing specs are being modified -->

## Impact

- New route and controller in `app/actions/verwaltung/users-export/controller.tsx`
- New route entry in `app/routes.ts` under `verwaltung`
- New route wiring in `app/router.ts`
- New UI page in `app/ui/` for the filter form
- Update `app/ui/verwaltung-page.tsx` to add dashboard card link
