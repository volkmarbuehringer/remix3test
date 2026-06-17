## 1. Route & Router

- [x] 1.1 Move `client` route entry from top-level `routes.client` to nested under `routes.admin.client` in `app/routes.ts`
- [x] 1.2 Remove `clientGrid: 'client-grid'` from the `frames` export in `app/routes.ts`
- [x] 1.3 Update `router.map` in `app/router.ts`: change `router.map(routes.client, clientController)` to `router.map(routes.admin.client, clientController)`

## 2. Controller

- [x] 2.1 Change `createController(routes.client, ...)` to `createController(routes.admin.client, ...)` in `app/actions/client/controller.tsx`
- [x] 2.2 Add `import { requireAdmin } from '../../middleware/admin.ts'` and add `requireAdmin()` to middleware array
- [x] 2.3 Replace `import { Layout } from '../../ui/layout.tsx'` with `import { renderAdminPage } from '../../ui/admin-layout.tsx'`
- [x] 2.4 Replace all `context.render(<Layout title="Client">...</Layout>)` with `renderAdminPage(context.render, 'client', ...)`
- [x] 2.5 Update all hardcoded `/client/...` URL strings in the controller to `/admin/client/...` (frameSrc, redirects, editingRedirect calls)

## 3. Page Component

- [x] 3.1 Update `app/actions/client/page.tsx`: remove Frame wrapper (renderAdminPage handles frame management), replace `frames.clientGrid` references

## 4. Grid Page

- [x] 4.1 Replace all `rmx-target="client-grid"` with `rmx-target="admin-content"` in `app/actions/client/grid-page.tsx`
- [x] 4.2 Update all hardcoded `/client` URLs in URL helper functions and form actions to `/admin/client`
- [x] 4.3 Update filter form action from `/client` to `/admin/client`
- [x] 4.4 Update delete form action from `/client/${row.id}` to `/admin/client/${row.id}`

## 5. Edit & Create Pages

- [x] 5.1 Update `app/actions/client/edit-page.tsx`: change form action from `/client/${row.id}` to `/admin/client/${row.id}` and cancel URL base from `/client` to `/admin/client`
- [x] 5.2 Update `app/actions/client/create-page.tsx`: change form action from `/client` to `/admin/client` and cancel URL base from `/client` to `/admin/client`

## 6. Assets

- [x] 6.1 Update `app/assets/client-grid-inline-edit.tsx`: change fetch URL from `/client/${rowId}` to `/admin/client/${rowId}`

## 7. Navigation & Labels

- [x] 7.1 Update `app/ui/admin-layout.tsx`: change nav item href from `routes.client.index.href()` to `routes.admin.client.index.href()` and remove `iframeNav: false`
- [x] 7.2 Remove "Client Lab" entry from `app/ui/nav.ts`
- [x] 7.3 Update `app/ui/admin-page.tsx`: change dashboard card link from `routes.client.index.href()` to `routes.admin.client.index.href()`

## 8. Route Labels & Breadcrumbs

- [x] 8.1 Update `app/route-labels.ts`: rename all `routes.client.*` references to `routes.admin.client.*`

## 9. Tests

- [x] 9.1 Update `app/actions/client/controller.test.ts`: replace all `/client` URL references with `/admin/client`
- [x] 9.2 Update `app/actions/client/grid-auto-refresh.test.ts`: replace all `/client` URL references with `/admin/client`
- [x] 9.3 Update `app/actions/client/grid-page.test.ts`: no URL changes needed (component tests)
- [x] 9.4 Update `app/actions/client/edit-page.test.ts`: no URL changes needed (component tests)

## 10. Verification

- [x] 10.1 Run `npm run typecheck` to verify TypeScript compiles
- [x] 10.2 Run `npm test` to verify all tests pass
- [x] 10.3 Run `grep -r "/client" app/ --include="*.ts" --include="*.tsx"` to audit for stale /client references
