## Context

The appointments list pages (`/appointments/new` and `/verwaltung/appointments`) use a grid-state system where all filter parameters (offset, sort, order, filter, period, status) are persisted as hidden form inputs. On successful create/update/destroy, these values are read via `gridStateFromFormData(formData)` and passed to `gridStateToParams(gridValues)` to build the redirect URL with the same filter context.

This is correct for validation errors (the user stays in the same filtered context), but wrong for successful mutations — the user wants to see the result of their action, which may be invisible if the active filter excludes it.

## Goals / Non-Goals

**Goals:**

- On successful create, update, or destroy, clear `period`, `filter`, and `offset` in the redirect URL
- Preserve `sort` and `order` (keep the user's sort preference)
- Preserve `status` behavior (defaults to `pending` which shows future appointments)
- Apply the same change to both the user-facing `/appointments/new` controller and the admin `/verwaltung/appointments` controller
- Leave validation-error re-render paths unchanged (preserve all filters during errors)

**Non-Goals:**

- No changes to the URL builder helpers (`buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, etc.) — those are for navigation, not post-mutation redirects
- No changes to the `grid-state-hidden.tsx` component — the form still needs to carry filter state for validation error handling
- No UI changes — the filter toolbar buttons continue working as before
- No new setting or preference for filter reset behavior

## Decisions

### Decision 1: Clear `period`, `filter`, `offset` (keep `sort`, `order`, `status`)

- **Chosen**: After successful mutation, reset `period` to empty (no period filter), `filter` to empty (no text search), and `offset` to `0`. Keep `sort`, `order`, and `status` as they were.
- **Alternatives considered**:
  - Reset everything to defaults: More disruptive — the user might have intentionally sorted by a specific column.
  - Only reset `period`: Incomplete — text search and pagination offset also block visibility.
  - Redirect to a clean URL with no params: Loses sort preference.
- **Rationale**: The primary reasons a new appointment would be invisible are: (1) a period filter that excludes its date, (2) a text search that doesn't match its title, (3) a pagination offset past the first page. Sort order and status (pending/expired) are less likely to hide a just-created appointment.

### Decision 2: Modify redirect code inline (no new utility function)

- **Chosen**: At each redirect site, clear the three fields from the `GridState` object before calling `gridStateToParams`.
- **Alternatives considered**:
  - Create a `resetFilterState(gridValues)` helper: Adds abstraction but only saves 2 lines per call site.
  - Modify `gridStateToParams` to accept an options parameter: Changes a shared utility used elsewhere.
  - Create a custom redirect function `redirectWithResetFilters(base, gridValues, ...)`: Over-engineered for the need.
- **Rationale**: The change is mechanical and localized — clear three properties on the GridState object. Inline is clearest.

### Decision 3: Also reset on destroy

- **Chosen**: Apply the same reset after successful destroy.
- **Alternatives considered**:
  - Keep filters on destroy: The deleted appointment is gone, but if the filter still hides some items, the user may wonder what happened.
  - Only reset on create/update (not destroy): Less consistent — destroy also changes the visible set.
- **Rationale**: Consistency. After any successful mutation (create, update, destroy), the user should see the default view.

## Risks / Trade-offs

- **[Temporary flash]** If the user had a complex filter applied (e.g., searching for "Smith" and then editing one of the results), the redirect will show the full list instead of just the matching results. Mitigation: this is a minor UX trade-off — the user can re-apply their filter with one click. The benefit of always seeing the result of the action outweighs the cost.
- **[No user control]** Some users might prefer to stay in their current filter context after editing. Mitigation: the "Zurücksetzen" link and the pre-edit navigation pattern (open edit in a new tab with the filter preserved) still work. If this becomes a common complaint, a user preference could be added later.
