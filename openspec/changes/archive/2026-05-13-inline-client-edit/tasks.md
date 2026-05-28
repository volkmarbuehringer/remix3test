## 1. Controller — Route Changes

- [x] 1.1 Reroute `/client/edit/:rowId` to redirect with `?editing=` — change `edit()` handler to 302 redirect to `/client?editing=:rowId&offset=...&sort=...&order=...`
- [x] 1.2 Update `index()` handler — accept `?editing=` param, fetch row with `db.find()`, pass `editRow` and grid state to `ClientPage`
- [x] 1.3 Update `save()` handler — read `_filter` hidden field alongside existing `_offset`, `_sort`, `_order`; include in redirect URL
- [x] 1.4 Update `destroy()` handler — preserve `filter` param in redirect URL (if not already handled)

## 2. Page Layout — ClientPage

- [x] 2.1 Update `ClientPage` — accept optional `editRow`, `editingOffset`, `editingSort`, `editingOrder`, `editingFilter` props
- [x] 2.2 Add two-column CSS layout (`gridTemplateColumns: '1fr 380px'`) when editing
- [x] 2.3 Render edit panel in right column with `position: sticky; top: 1.5rem` when `editRow` is present
- [x] 2.4 Hide edit panel when no `?editing=` param (single-column centered layout preserved)

## 3. Edit Component — ClientEditPage

- [x] 3.1 Remove `Breadcrumbs` component — not needed when edit panel is inline alongside grid
- [x] 3.2 Remove `maxWidth: 520px` and `margin: 0 auto` constraints — panel width is controlled by parent grid layout
- [x] 3.3 Add `cancelUrl` helper that builds `/client?offset=...&sort=...&order=...&filter=...` (no `?editing=`)
- [x] 3.4 Add hidden `_filter` field to form
- [x] 3.5 Accept filter param in component props, pass to `buildCancelUrl` and hidden field

## 4. Grid — Edit Button URL

- [x] 4.1 Update `buildEditUrl()` — change URL from `/client/edit/:rowId?offset=...&sort=...&order=...` to `/client?editing=:rowId&offset=...&sort=...&order=...&filter=...`
- [x] 4.2 Add `filter` param to `buildEditUrl()` function signature
- [x] 4.3 Add `target="_top"` to edit button links so they navigate the top-level page (not inside grid frame)
