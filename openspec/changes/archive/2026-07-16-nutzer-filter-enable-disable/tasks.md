## 1. Route — Add toggle-disabled endpoint

- [x] 1.1 Add `toggleDisabled: post('/:id/toggle-disabled')` to the `users` route definition in `app/routes.ts`

## 2. Controller — Toggle-disabled action

- [x] 2.1 Add `toggleDisabled` action to `app/actions/admin/users/controller.tsx`: validate ID, find user, toggle `disabled_at` between `null` and `Date.now()`, return `{ ok: true, disabled: boolean }`

## 3. Controller — Status filter in index

- [x] 3.1 Modify the `index` action to detect `filter="enabled"` (add `disabled_at IS NULL`) and `filter="disabled"` (add `disabled_at IS NOT NULL`) as special filter values alongside the existing trigram search
- [x] 3.2 Add `disabled_at` to the `SafeUser` type and projection (needed by context menu for conditional menu item rendering)
- [x] 3.3 Pass `disabled_at` through the grid state JSON and context menu data

## 4. UI — Status filter dropdown in filter bar

- [x] 4.1 Add a filter tab group to the filter bar in `app/ui/admin-users-page.tsx` with "Alle", "Aktiv", "Deaktiviert" links
- [x] 4.2 Wire tabs via anchor links so selection navigates to `?filter=<value>` preserving sort + offset
- [x] 4.3 Active tab highlighted based on current `filter` value

## 5. UI — Disabled visual indicator in table

- [x] 5.1 Add a "Status" column to the table showing a badge ("Aktiv"/"Deaktiviert")
- [x] 5.2 Add conditional row styling (muted opacity) for disabled users

## 6. UI — Edit panel disabled checkbox

- [x] 6.1 Add a "Deaktiviert" checkbox to `AdminUsersEditPanel` in `app/ui/admin-users-page.tsx`
- [x] 6.2 Add `disabled` field handling to the update schema and controller's `update` action

## 7. Context menu — Enable/disable items

- [x] 7.1 Modify `app/assets/admin-users-context-menu.tsx` to read `disabled_at` from `data-disabled-at` attribute on the row
- [x] 7.2 Add conditional menu items: "Deaktivieren" (when active) / "Aktivieren" (when disabled)
- [x] 7.3 Wire menu item to `fetch POST /admin/users/:id/toggle-disabled` with CSRF token, reload page on success

## 8. Tests

- [x] 8.1 Add controller test for `?filter=enabled` showing only active users
- [x] 8.2 Add controller test for `?filter=disabled` showing only disabled users
- [x] 8.3 Add controller test for toggle-disabled endpoint (toggle on, toggle off, non-existent user)
- [x] 8.4 Add controller test for delete preserving status filter
- [x] 8.5 Run `pnpm run typecheck` and `pnpm test`
