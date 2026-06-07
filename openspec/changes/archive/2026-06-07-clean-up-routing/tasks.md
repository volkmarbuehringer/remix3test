## 1. Router registration cleanup

- [x] 1.1 Convert `router.get(routes.auth.registerSent.href(), registerSent)` to `router.get(routes.auth.registerSent, registerSent)` in `app/router.ts`
- [x] 1.2 Convert `router.get(routes.auth.verify.href({ token: ':token' }), verify)` to `router.get(routes.auth.verify, verify)` in `app/router.ts`
- [x] 1.3 Convert `router.post(routes.auth.logout.href(), authLogout)` to `router.post(routes.auth.logout, authLogout)` in `app/router.ts`

## 2. Route label registration system

- [x] 2.1 Create `app/route-labels.ts` module that imports route objects and builds a label map derived from `routes.*.href()` calls
- [x] 2.2 Update `app/ui/breadcrumbs.tsx` to import from `app/route-labels.ts` instead of `./route-labels.ts`
- [x] 2.3 Remove old `app/ui/route-labels.ts` string map

## 3. Verwaltung UI page components

- [x] 3.1 Convert `app/ui/admin-offering-configs-page.tsx` — replace hardcoded `/verwaltung/offering-configs` with `routes.verwaltung.offeringConfigs.index.href()`
- [x] 3.2 Convert `app/ui/admin-offerings-page.tsx` — replace hardcoded `/verwaltung/offerings` with `routes.verwaltung.offerings.index.href()`
- [x] 3.3 Convert `app/ui/admin-offerings-edit-page.tsx` — same pattern
- [x] 3.4 Convert `app/ui/admin-offerings-create-page.tsx` — same pattern
- [x] 3.5 Convert `app/ui/admin-offerings-config-page.tsx` — same pattern, also `/verwaltung/offerings/config`
- [x] 3.6 Convert `app/ui/admin-appointments-page.tsx` — replace `/verwaltung/appointments` with typed href
- [x] 3.7 Convert `app/ui/admin-appointments-form.tsx` — same pattern
- [x] 3.8 Convert `app/ui/admin-resources-page.tsx` — replace `/verwaltung/resources` with typed href

## 4. Admin UI page components

- [x] 4.1 Convert `app/ui/admin-users-page.tsx` — replace hardcoded `/admin/users` with `routes.admin.users.index.href()`
- [x] 4.2 Convert `app/ui/admin-chatlog-page.tsx` — replace `/admin/chatlog` with `routes.admin.chatlog.index.href()`
- [x] 4.3 Convert `app/ui/admin-lists-page.tsx` — replace `/admin/lists` with `routes.admin.lists.index.href()`
- [x] 4.4 Convert `app/ui/admin-messages-page.tsx` — replace `/admin/messages` with `routes.admin.messages.index.href()`

## 5. Appointment section UI components

- [x] 5.1 Convert `app/ui/appointment-page.tsx` — replace `<Frame src="/appointment/types">` with `routes.appointment.types.index.href()` and `<ConnectionIndicator url="/appointment/events">` with `routes.appointment.events.href()`
- [x] 5.2 Convert `app/ui/appointment-grid.tsx` — replace `fetch('/appointment/...')` calls; pass base href via script tag data
- [x] 5.3 Convert `app/ui/appointtype-panel.tsx` — replace `fetch('/appointment/types/...')` calls; pass base href via script tag data

## 6. Client-side assets

- [x] 6.1 Convert `app/assets/admin-appointments-context-menu.tsx` — replace hardcoded `/verwaltung/appointments` redirect with typed href from grid state
- [x] 6.2 Convert `app/assets/admin-users-context-menu.tsx` — replace hardcoded `/admin/users` redirect with typed href from grid state
- [x] 6.3 Convert `app/assets/admin-delete-past-button.tsx` — replace hardcoded `/verwaltung/offerings/delete-past` form action with prop-based URL

## 7. Verify

- [x] 7.1 Run full test suite — `npm test`
- [x] 7.2 Run typecheck — `npm run typecheck`
- [x] 7.3 Manually verify navigation, forms, breadcrumbs in admin, verwaltung, and appointment sections
