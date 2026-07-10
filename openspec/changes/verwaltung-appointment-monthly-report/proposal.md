## Why

Admins need a quick way to see per-user appointment activity in a given month — how many appointments a user had, their first/last date, and total booked hours. Currently there's no aggregated view; admins must scan the full appointment list.

## What Changes

- New route `/verwaltung/report1` with year/month pickers and optional user filter
- New controller that runs a GROUP BY query on appointments, aggregated by user
- New UI page showing the report table with user name, count, first/last date, total hours, and avg hours
- Nav link added under "Verwaltung"

## Capabilities

### New Capabilities

- `appointment-monthly-summary`: Aggregate appointment data by user for a given year/month, with optional user_id filter, showing count, min/max date, total hours

### Modified Capabilities

(none)

## Impact

- `app/routes.ts` — add route
- `app/actions/verwaltung/controller.tsx` — add controller export
- `app/router.ts` — wire route to controller
- `app/ui/` — add report page component
- `app/ui/nav.ts` — add nav link
