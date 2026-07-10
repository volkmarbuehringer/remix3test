## Why

The admin appointments page has visible Edit/Delete action buttons per row that take up horizontal space and clutter the table. A right-click context menu provides a cleaner interface, matches the existing context menu pattern in `appointtype-panel.tsx`, and allows room for future actions (e.g., "View details", "Copy ID") without adding more buttons. The existing `appointtype-panel.tsx` context menu works but uses a fragile hidden-trigger hack that doesn't scale — this change implements the correct `menu.contextTrigger()` pattern directly on row elements.

## What Changes

- Replace the visible Edit/Delete button group in each admin appointments table row with a right-click context menu
- The context menu opens on right-click anywhere on the row and offers "Edit" and "Delete" actions
- "Edit" navigates to the inline editing mode (same as current edit button behavior)
- "Delete" submits the DELETE form (same as current delete button behavior)
- The `menu.contextTrigger()` mixin is applied directly to each `<tr>` element (not via a hidden proxy trigger)
- The fragile hidden-trigger + synthetic event + `setTimeout` pattern from `appointtype-panel.tsx` is documented as the anti-pattern to avoid

## Capabilities

### New Capabilities

- `admin-appointments-context-menu`: Right-click context menu for admin appointments table rows with Edit and Delete actions

### Modified Capabilities

<!-- No existing specs are modified -->

## Impact

- **File modified**: `app/ui/admin-appointments-page.tsx` — replace action button cell with context menu; add `menu.Context`, `MenuList`, `MenuItem` components; add `clientEntry` for client-side interactivity
- **File modified**: `app/actions/admin-appointments-controller.tsx` — possibly adjust if context menu actions need different form submission (DELETE still uses RestfulForm via context menu)
- **No new dependencies** — `remix/ui/menu` is already available in the project
- **No API changes** — uses existing routes (`/admin/appointments/:id` for DELETE, inline edit URL for Edit)
