## Context

The appointments admin page at `/verwaltung/appointments` shows a table of all appointments with search, period filtering, sorting, and pagination. There is currently no way to filter by appointment status (pending vs expired). The filter bar uses a `<form method="GET" rmx-target={frames.adminContent}>` with query params preserved across navigation.

The existing `GridState` model tracks `offset`, `sort`, `order`, `filter`, and `period` — every URL-building helper, hidden input set, and controller data loader carries these through. The `period` param and its `GridState` field provide the exact pattern to follow for a new `status` param.

## Goals / Non-Goals

**Goals:**
- Add a radio button group to the appointments filter bar with "Ausstehend" (pending) and "Abgelaufen" (expired) options
- Default to pending when no `status` param is present (show appointments with `a.date >= now`)
- When expired is selected, show appointments with `a.date < now`
- Preserve `status` across pagination, sorting, period filtering, search, grid state, and create/edit redirects (following the `period` pattern exactly)
- Only affect the appointments list view — no schema changes, no database migrations

**Non-Goals:**
- No changes to other admin pages (offerings, resources, etc.)
- No database schema changes or new columns
- No API-level changes — only the admin UI and its controller
- No real-time/SSE filtering — the existing SSE invalidate + reload pattern is sufficient

## Decisions

1. **Reuse the `period` filter bar pattern instead of adding new URL helpers**
   - The radio buttons live inside the existing `<form method="GET">` as a `<fieldset>` with two `<input type="radio">` elements, placed after the period button group and before the "Neu" button
   - A new `status` query param flows through the same `buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, and `gridStateToParams` functions
   - *Alternative considered:* Custom JS toggle outside the form — rejected because it breaks frame-based navigation and the GET-form pattern used everywhere else
   - *Alternative considered:* Dropdown/select — rejected because radio buttons are more explicit for a binary choice

2. **SQL filtering using `a.date` column**
   - `status=pending` → `WHERE a.date >= EXTRACT(EPOCH FROM NOW())::bigint * 1000` (or similar server-side now)
   - `status=expired` → `WHERE a.date < ...`
   - The filter is ANDed with existing search and period WHERE clauses
   - *Alternative considered:* Adding a `status` computed column — rejected, no need; `a.date` is sufficient
   - *Alternative considered:* Client-side filtering — rejected, breaks pagination and server-side search

3. **Default to pending when no status param is provided**
   - In the controller, if `context.url.searchParams.get('status')` is not set, act as if `status=pending`
   - This keeps the default view focused on actionable appointments
   - The radio group renders with "Ausstehend" preselected when no status param is present
   - *Alternative considered:* Show all by default — rejected per user request ("pending is default")

4. **No new capability spec needed — purely additive UI filter**
   - This is an admin-only UX enhancement with no public API surface, no external contract, and no new data domain
   - The change is entirely contained within the existing appointments controller, page component, and grid state helpers

## Risks / Trade-offs

- [Risk] The `status` param interacts with `period` — a user could select "expired" + "next-week". The SQL WHERE clauses combine naturally (AND), and this is valid behavior (shows expired appointments within next week's range).
- [Risk] Users might expect a "show all" option — but the radio is binary (pending/expired). If both are deselected, default pending applies. A third "all" option would add complexity without clear need.
- [Trade-off] Adding `status` to every URL builder and hidden input increases the param surface. This follows the established `period` pattern exactly so it's mechanically simple, just touch-point heavy.
