## Why

The admin offerings page still uses visible Edit/Delete action buttons per row — the same pattern that was replaced with a context menu on the appointments page. The admin appointments page now has a context menu but the old action buttons remain visible, adding clutter. This change brings the offerings page in line with the established context menu pattern and cleans up the appointments page by removing the now-redundant action buttons.

## What Changes

### Admin Offerings — Add context menu
- Add a right-click context menu to each offerings table row with Edit and Delete actions
- Follow the established hidden-trigger pattern from `admin-appointments-context-menu.tsx`
- Context menu opens on right-click anywhere on the row
- Edit navigates to the inline editing mode preserving grid state
- Delete shows confirmation then submits the existing RestfulForm via `.requestSubmit()`

### Admin Appointments — Remove action buttons
- Remove the Edit/Delete glyph button group from each appointments table row
- Remove the `actionCellStyle`, `btnGroupStyle`, `editBtnStyle`, `delBtnStyle` CSS mixins (no longer used)
- The context menu (already implemented) becomes the sole action mechanism
- Adjust the `colgroup` to redistribute the freed column width proportionally

## Capabilities

### New Capabilities
- `offerings-context-menu`: Right-click context menu for admin offerings table rows with Edit and Delete actions

### Modified Capabilities
- `admin-appointments-context-menu`: Remove the visible action buttons; context menu is now the only action mechanism. Update spec to reflect this.

## Impact

- **File created**: `app/assets/admin-offerings-context-menu.tsx` — clientEntry following the same pattern as the appointments context menu
- **File modified**: `app/ui/admin-offerings-page.tsx` — add data attributes, grid state JSON, render clientEntry, add `data-delete-form` on RestfulForm
- **File modified**: `app/ui/admin-appointments-page.tsx` — remove action buttons cell and associated styles, adjust colgroup widths, remove unused imports
