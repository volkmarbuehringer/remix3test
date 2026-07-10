## Context

The admin appointments page (`/verwaltung/appointments`) currently supports sorting and text-based filtering but has no time-period filter. The admin offerings page (`/verwaltung/offerings`) already implements period-based filtering with `getPeriodRange()` that maps period strings ("this-week", "next-week", "this-month", "next-month") to date ranges, applied as SQL WHERE clauses on the day column.

The goal is to port this exact pattern to admin appointments, reusing the existing infrastructure where possible. The `GridState` type and `grid-state.ts` utilities already support a `period` field — no schema changes needed there.

**Current state of admin appointments:**

- Controller: `app/actions/admin-appointments/controller.tsx`
- Page UI: `app/ui/admin-appointments-page.tsx`
- Form: `app/ui/admin-appointments-form.tsx`
- Grid state utils: `app/utils/grid-state.ts` (already has `period` support)
- The admin appointments table is sorted/filtered by `offset`, `sort`, `order`, `filter` query params — `period` is not yet read or applied

**Current state of admin offerings (reference pattern):**

- `getPeriodRange()` in `app/actions/admin-offerings/controller.tsx` (lines 94–126) — converts period string to `{ startMs, endMs }`
- SQL filtering: `AND ao.day >= $X AND ao.day < $Y` (lines 192–205)
- UI buttons in `app/ui/admin-offerings-page.tsx` (lines 170–202) with `buildPeriodUrl()` helper
- Period carried through create/edit forms via hidden inputs

## Goals / Non-Goals

**Goals:**

- Add five period filter buttons to the admin appointments page toolbar: Alle (all), Diese Woche, Nächste Woche, Diesen Monat, Nächsten Monat
- Filter appointments by `day` column in SQL when a period is selected
- Preserve period in URL across sorting, pagination, and form submissions
- Reuse the existing `getPeriodRange()` pattern and `GridState.period` field

**Non-Goals:**

- Changing the user-facing `/appointment` calendar page (this is a different UI paradigm with week-based navigation)
- Adding new period types beyond the five already used in offerings
- Modifying the admin offerings implementation
- Internationalizing the filter labels

## Decisions

**Decision 1: Copy `getPeriodRange()` into the admin appointments controller**

The function is small (~30 lines) and tightly coupled to the SQL query it serves. Extracting it into a shared utility would add a dependency and indirect coupling between two features that happen to share a pattern. Keeping it colocated with the controller that uses it follows the existing project convention.

**Alternative considered:** Extract `getPeriodRange()` to `app/utils/`. Rejected because the function is only 30 lines and the project uses feature-colocation (each controller owns its helpers).

**Decision 2: Filter on `oa.day` (day of the appointment), not `oa.created_at`**

The offerings page filters on the offering day. For appointments, the semantically equivalent column is `oa.day` (the date the appointment occurs). This matches user expectation — filtering by "this week" should show appointments happening this week, not created this week.

**Decision 3: Use the same button layout and styling as admin offerings**

The five buttons are rendered as a horizontal segmented control using `<a>` links wrapping `<Button>` components. The active button gets `tone="primary"`, inactive gets `tone="secondary"`. Clicking the active button deselects (resets to no filter).

## Risks / Trade-offs

- **Risk:** The appointments SQL query already has dynamic WHERE clause construction for the text filter. Adding period filtering needs careful WHERE clause assembly to avoid SQL errors.
  - **Mitigation:** Follow the same pattern from offerings — check if a WHERE clause already exists, prepend WHERE vs AND accordingly.
- **Risk:** If the period buttons carry the period through hidden form inputs on create/edit, but the period filter is applied before the form submit, the user may lose context after submission.
  - **Mitigation:** Reuse the existing `gridStateFromFormData` and `gridStateToParams` utilities which already handle `period` preservation.
