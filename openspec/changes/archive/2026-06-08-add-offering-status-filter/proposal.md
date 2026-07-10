## Why

The offerings admin page currently shows all offerings regardless of their date. Administrators need the same pending/expired toggle that was recently added to the appointments page — showing only upcoming offerings by default, with the option to review expired ones.

## What Changes

- Add a button group to the offerings filter bar with "Ausstehend" (pending) and "Abgelaufen" (expired) options, matching the appointments status toggle pattern
- Pending is the default filter — when no `status` param is set, only future offerings (`ao.day >= now`) are shown
- The SQL query gains a `WHERE` clause on `ao.day` based on the selected status
- The `status` query parameter is preserved across pagination, sorting, period filter, search, grid state, and all navigation actions
- The `OfferingPageData` interface gains a `status` field

## Capabilities

### New Capabilities

- `offering-status-filter`: Server-side status filter (pending/expired) for the offering admin list, with URL-preserved state across navigation actions

### Modified Capabilities

<!-- No existing spec-level capabilities are changing -- this is purely additive -->

## Impact

- **Controller** (`app/actions/verwaltung/controller.tsx`): Extend `OfferingPageData`, `loadOfferingPageData()` SQL query, and `renderOfferingsPage()` to handle the `status` query parameter
- **Page component** (`app/ui/admin-offerings-page.tsx`): Add status button group to the filter bar; update URL builders, grid state, and JSON state to carry `status`
- **Edit/Create/Config pages**: `GridStateHiddenInputs` in side panels need to include `status`
- **Grid state**: Already includes `status` from the previous change — no changes to `app/utils/grid-state.ts` or URL helpers needed
