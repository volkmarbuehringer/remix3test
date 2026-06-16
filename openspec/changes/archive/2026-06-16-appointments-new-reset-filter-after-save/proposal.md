## Why

When a user creates or edits an appointment at `/appointments/new` (or `/verwaltung/appointments`), the redirect preserves the current filter criteria (period, status, text search, pagination offset) from hidden form inputs. If the user had a period filter active (e.g., "Diese Woche") or a text search active, the newly created or edited appointment may fall outside those criteria and be invisible after the redirect. This creates a confusing experience — the user just made a change but cannot see the result without manually clearing filters.

## What Changes

- **After successful create**: Reset `period`, `filter`, and `offset` parameters in the redirect URL so the list shows the default view (future/pending appointments). On both routes: `/appointments/new` (user-facing) and `/verwaltung/appointments` (admin).
- **After successful update**: Same reset — clear period, filter, and offset so the edited appointment appears in the default view.
- **After successful destroy**: Same reset — the deleted appointment is gone, but the remaining list should show the default view rather than the stale filtered view.
- **The status parameter is preserved**: Keep the default `pending` behavior (showing future appointments). If the user wants to see all, they can click the "Ausstehend" toggle or the "Zurücksetzen" link.
- **No changes to error/validation paths**: When validation fails, the filter context must be preserved so the re-rendered form panel stays in the same context.

## Capabilities

### Modified Capabilities

- `appointments-new-page`: Create, update, and destroy actions no longer carry forward `period`, `filter`, or `offset` parameters on successful redirect
- `verwaltung-appointments`: Same change for the admin route's create, update, and destroy actions

## Impact

- **`app/actions/appointments-new/controller.tsx`**: Modify the redirect URL construction in `create`, `update`, and `destroy` to omit `period`, `filter`, and `offset`
- **`app/actions/verwaltung/appointments/controller.tsx`**: Same modifications for the admin controller's `create`, `update`, and `destroy` actions
- **`app/utils/grid-state.ts`**: No change needed — the existing `gridStateToParams` already only includes non-empty values, so we just clear the fields before calling it
