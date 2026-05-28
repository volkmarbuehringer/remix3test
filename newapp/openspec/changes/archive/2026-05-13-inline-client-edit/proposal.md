## Why

The client lab's grid and edit form currently live on separate pages. Clicking "Edit" navigates to `/client/edit/:rowId`, losing grid context (scroll position, visual reference). After saving, the user is redirected back but the grid reloads from scratch. This interrupts the edit workflow — there's no visual continuity between browsing the grid and editing a row.

Place the edit form inline alongside the grid, on the same page. The user sees both the grid and the edit panel simultaneously, can reference row data while editing, and returns to the grid naturally after saving.

## What Changes

- Remove standalone `/client/edit/:rowId` route — redirect to `/client?editing=:rowId`
- Add edit panel to `ClientPage` — rendered inline alongside the grid frame when `?editing=` param is present
- Change grid Edit buttons to navigate to `/client?editing=:rowId&offset=...&sort=...&order=...&filter=...`
- Preserve all grid state (offset, sort, order, filter) through the edit → save → redirect lifecycle
- Refactor `ClientEditPage` to work as an inline panel (no breadcrumbs, no standalone page chrome)
- `/client/grid` route, grid handler, save handler, destroy handler remain unchanged

## Capabilities

### New Capabilities

- `inline-edit`: Inline row editing within the client grid — edit panel appears alongside grid frame, form posts to existing save route, 302 redirect clears edit and refreshes grid

### Modified Capabilities

*(none — no existing specs to modify)*

## Impact

- **Remove**: `GET /client/edit/:rowId` route and its handler
- **Modify**: `ClientPage` — add `editRow` prop, two-column layout
- **Modify**: `grid-page.tsx` — Edit button URL changes
- **Modify**: `edit-page.tsx` — remove standalone chrome, adapt for inline rendering
- **Modify**: `controller.tsx` `index()` — accept `?editing=` param, fetch row
- **No change**: grid frame, save/destroy handlers, pagination, sorting, filtering
