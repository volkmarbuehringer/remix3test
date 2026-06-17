## 1. Routes and Router

- [x] 1.1 Move `nutzer{}` route block from top-level into `admin{}` in `routes.ts`
- [x] 1.2 Change `router.map(routes.nutzer, ...)` to `router.map(routes.admin.nutzer, ...)` in `router.ts`
- [x] 1.3 Update import in `router.ts` (already imports `adminNutzerController`)

## 2. Controller Rendering

- [x] 2.1 Import `renderAdminPage` from `admin-layout.tsx` in nutzer controller
- [x] 2.2 Change all 5 `context.render(<Layout title="Nutzer">...)` calls to use sidebar layout — index via `renderAdminPage()`, error paths via `<AdminLayout>` directly to avoid Frame GET fallback
- [x] 2.3 Change 3 `redirect('/nutzer'...)` calls to use `routes.admin.nutzer.index.href()`

## 3. Frame-Aware Navigation (admin-nutzer-page.tsx)

- [x] 3.1 Import `{ frames }` from `routes.ts`
- [x] 3.2 Change `ADMIN_BASE` from `'/nutzer'` to `routes.admin.nutzer.index.href()`
- [x] 3.3 Add `rmx-target={frames.adminContent}` to: filter form, clear filter link, "Neu anlegen" link, all sort header links, both pagination links

## 4. Form Actions and URLs

- [x] 4.1 Change form action in `admin-nutzer-create-page.tsx`
- [x] 4.2 Change form action in `admin-nutzer-edit-page.tsx`
- [x] 4.3 Update `buildCancelUrl('/nutzer', ...)` calls in both edit and create pages
- [x] 4.4 Update all `fetch()` and `window.location` URLs in `nutzer-table-interactive.tsx`

## 5. Nav Integration

- [x] 5.1 Add `'nutzer'` to `AdminNavItem` type and `NAV_GROUPS` in `admin-layout.tsx`
- [x] 5.2 Update `nav.ts` href from `'/nutzer'` to `'/admin/nutzer'`

## 6. Tests

- [x] 6.1 Update all hardcoded `/nutzer` URL assertions in `controller.test.tsx` to `/admin/nutzer`
- [x] 6.2 Update `NUTZER_URL` constant and route href test
- [x] 6.3 Update `rmx-target` assertions (now checks for presence, not absence)

## 7. Verify

- [x] 7.1 Run `npm run typecheck` — clean
- [x] 7.2 Run `npm test` — 711 tests pass, 0 failures
- [x] 7.3 Start dev server and manually verify — form validation errors show correctly with sidebar
