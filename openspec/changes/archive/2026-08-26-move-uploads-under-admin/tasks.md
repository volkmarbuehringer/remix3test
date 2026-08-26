## 1. Route definition (app/routes.ts)

- [x] 1.1 Remove the top-level `uploads: form('uploads')` entry and the `system.uploadsDownload` key; verified `routes.uploads` and `system.uploadsDownload` no longer exist (`npm run typecheck` clears)
- [x] 1.2 Add `uploads: route('uploads', { index: get('/'), action: post('/'), download: get('/:id/download') })` under the `admin` route tree; verified `routes.admin.uploads.index`, `.action`, and `.download` typecheck

## 2. Controller relocation

- [x] 2.1 Move `app/actions/uploads/controller.tsx` to `app/actions/admin/uploads/controller.tsx` and fix the one-level-deeper relative imports (`../../...` → `../../../...`); verified the file resolves (`npm run typecheck` clears)
- [x] 2.2 Update route references inside the relocated controller (`routes.uploads` → `routes.admin.uploads`, `routes.uploads.action` → `routes.admin.uploads.action`) and fold the former standalone download handler into the controller as a `download` action (a nested flat route requires a controller action, like `users.toggleDisabled`); verified no `routes.uploads`/`system.uploadsDownload` token remains

## 3. Router and admin entry wiring

- [x] 3.1 In `app/actions/admin/controller.tsx`, add `export { default as adminUploads } from './uploads/controller.tsx'`; verified the named export typechecks
- [x] 3.2 In `app/router.ts`, drop the `./actions/uploads/controller.tsx` import and re-map `router.map(routes.uploads, uploadsController)` → `router.map(routes.admin.uploads, admin.adminUploads)`; the download is a controller action on the same route group, so no separate `router.get` is needed; verified via `npm run typecheck`

## 4. Admin nav and breadcrumb

- [x] 4.1 In `app/ui/admin-layout.tsx`, changed the `uploads` nav item route from `routes.uploads.index` to `routes.admin.uploads.index`; verified the admin sidebar renders an "Uploads" link at `/admin/uploads`
- [x] 4.2 In `app/route-labels.ts`, added `[routes.admin.uploads.index.href()]: 'Uploads'` in the Admin group; verified breadcrumbs render "Uploads" at `/admin/uploads` (ROUTE_LABELS is consumed by `app/ui/breadcrumbs.tsx`)

## 5. Agent navigation prompt

- [x] 5.1 In `app/actions/mastra/agents/route-agent.ts`, changed `navigate('/uploads')` to `navigate('/admin/uploads')` in the upload navigation protocol; verified the prompt no longer references the old top-level `/uploads`

## 6. Verification

- [x] 6.1 `npm run typecheck` passes with no `routes.uploads` / `system.uploadsDownload` / stale-import errors
- [x] 6.2 Run `npm test` and confirm the uploads data tests and the broader suite pass (no path-coupled uploads route tests exist) — full suite: 1185 pass / 0 fail
- [x] 6.3 `grep -rn "'/uploads'" app/` and `grep -rn "routes.uploads\|system.uploadsDownload" app/` — no residual old-path references remain (only `/admin/uploads` forms present)
- [x] 6.4 Smoke-check in the running app — in-process routing smoke verified: GET `/admin/uploads` → 200 (admin + non-admin, renders "Datei-Upload"), unauth → 302; legacy `GET /uploads` and `GET /uploads/:id/download` → 404; download non-existent → 404, non-numeric id → 400 (7/7 passed)
