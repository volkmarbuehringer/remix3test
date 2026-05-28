## 1. Create the clientEntry for context menu interactivity

- [x] 1.1 Create `app/assets/admin-appointments-context-menu.tsx` as a `clientEntry` component
- [x] 1.2 Add data attributes to table rows in `admin-appointments-page.tsx`: `data-admin-appointment-row`, `data-row-id`, `data-grid-state`
- [x] 1.3 Add a JSON data element for the grid state that the clientEntry can read
- [x] 1.4 Render `AdminAppointmentsContextMenu` (the clientEntry) at the bottom of the table section in the page template

## 2. Implement context menu with Edit and Delete actions

- [x] 2.1 In the clientEntry, render `<menu.Context>` wrapping a hidden trigger element (position:fixed, opacity:0) with `menu.contextTrigger()` mixin
- [x] 2.2 Add `MenuList` with "Edit" (Bearbeiten) and "Delete" (Löschen) MenuItem components inside the `<menu.Context>`
- [x] 2.3 Attach `onMenuSelect` handler to the `MenuList` that dispatches to Edit or Delete based on event.item.name

## 3. Wire up context menu to server-rendered rows

- [x] 3.1 On clientEntry mount, attach `contextmenu` event delegation on the table container (`[data-appointments-table]`)
- [x] 3.2 On right-click, prevent default, store the right-clicked row's ID from `data-row-id`, position the hidden trigger at the mouse coordinates, and dispatch a synthetic `contextmenu` event
- [x] 3.3 Handle "Edit" action: navigate to the inline edit URL preserving grid state (same logic as existing edit button)
- [x] 3.4 Handle "Delete" action: show confirmation dialog (`confirm("Wirklich löschen?")`), then find and submit the row's hidden `RestfulForm` via `.requestSubmit()`

## 4. Clean up and verify

- [x] 4.1 Ensure the existing Edit/Delete buttons remain functional alongside the context menu
- [x] 4.2 Verify the context menu does not interfere with table sorting, filtering, pagination
- [x] 4.3 Verify the context menu does not interfere with left-click row behavior
- [x] 4.4 Run typecheck: `pnpm run typecheck`
