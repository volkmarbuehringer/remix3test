## 1. Route Tree

- [x] 1.1 Create `verwaltungRoutes` export in `app/routes.ts` with root `verwaltung` route containing index (dashboard) and sub-routes for offerings, appointments, resources, offeringConfigs
- [x] 1.2 Remove `offerings`, `appointments`, `resources`, `offeringConfigs` sub-routes from `adminRoutes.admin` in `app/routes.ts`

## 2. New UI Files

- [x] 2.1 Create `app/ui/verwaltung-layout.tsx` — simple full-page layout with breadcrumbs, no sidebar, exports `renderVerwaltungPage` function
- [x] 2.2 Create `app/ui/verwaltung-page.tsx` — dashboard component with card-based navigation linking to `/verwaltung/offerings`, `/verwaltung/appointments`, `/verwaltung/resources`, `/verwaltung/offering-configs`

## 3. New Controller

- [x] 3.1 Create `app/actions/verwaltung-controller.tsx` — index action rendering dashboard with `[requireAuth(), requireAdmin()]` middleware

## 4. Update Existing Controllers

- [x] 4.1 Update `app/actions/admin-offerings-controller.tsx` — change route import from `adminRoutes` to `verwaltungRoutes`, change render import from `renderAdminPage` to `renderVerwaltungPage`
- [x] 4.2 Update `app/actions/admin-appointments-controller.tsx` — change route import from `adminRoutes` to `verwaltungRoutes`, change render import from `renderAdminPage` to `renderVerwaltungPage`, update activeItem value
- [x] 4.3 Update `app/actions/admin-resources-controller.tsx` — change route import from `adminRoutes` to `verwaltungRoutes`, change render import from `renderAdminPage` to `renderVerwaltungPage`, update activeItem value
- [x] 4.4 Update `app/actions/admin-offering-configs-controller.tsx` — change route import from `adminRoutes` to `verwaltungRoutes`, change render import from `renderAdminPage` to `renderVerwaltungPage`, update activeItem value

## 5. Update Router

- [x] 5.1 Add `verwaltungRoutes.verwaltung` mapping to verwaltung controller in `app/router.ts`
- [x] 5.2 Map `verwaltungRoutes.verwaltung.offerings` to admin offerings controller
- [x] 5.3 Map `verwaltungRoutes.verwaltung.appointments` to admin appointments controller
- [x] 5.4 Map `verwaltungRoutes.verwaltung.resources` to admin resources controller
- [x] 5.5 Map `verwaltungRoutes.verwaltung.offeringConfigs` to admin offering configs controller
- [x] 5.6 Remove old `adminRoutes.admin.offerings`, `adminRoutes.admin.appointments`, `adminRoutes.admin.resources`, `adminRoutes.admin.offeringConfigs` mappings

## 6. Update Admin Layout

- [x] 6.1 Remove `offerings`, `appointments`, `resources`, `offeringConfigs` from `AdminNavItem` union type in `app/ui/admin-layout.tsx`
- [x] 6.2 Remove corresponding nav items from `NAV_GROUPS` in `app/ui/admin-layout.tsx`
- [x] 6.3 Remove unused icon functions for removed nav items from `app/ui/admin-layout.tsx`

## 7. Update Tests

- [x] 7.1 Update route references in `app/actions/admin-offerings-controller` tests (if any) to use `/verwaltung` prefix
- [x] 7.2 Update route references in `app/actions/admin-appointments-controller` tests to use `/verwaltung` prefix
- [x] 7.3 Update route references in `app/actions/admin-resources-controller.test.ts` to use `/verwaltung` prefix
- [x] 7.4 Update route references in `app/actions/admin-offering-configs-controller.test.ts` to use `/verwaltung` prefix
- [x] 7.5 Update route references in `app/router.test.ts` to reflect new route mappings

## 8. Verify

- [x] 8.1 Run `npm run typecheck` and fix any type errors
- [x] 8.2 Run `npm test` and ensure all tests pass
