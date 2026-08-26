## Why

`/uploads` is served at the top-level path `/uploads` even though it is already framed in the admin sidebar layout and listed as an admin nav item next to `/admin/users`, `/admin/lists`, and `/admin/chatlog`. That makes the URL hierarchy inconsistent: admin-owned pages live under `/admin`, but uploads sits at the root. Relocating it into the admin tree (`/admin/uploads`) puts uploads at the same URL level as `/admin/users` and the rest of the admin section.

## What Changes

- **BREAKING**: Relocate the uploads route from the top-level `form('uploads')` path into the `admin` route tree so it is served at `/admin/uploads`. The old top-level `/uploads` path is removed (no redirect/alias).
- **BREAKING**: Relocate the file-download endpoint from `/uploads/:id/download` to `/admin/uploads/:id/download`.
- Keep the page semantics unchanged: an authenticated user still uploads a single file and lists/downloads the files they own; admins see all uploads. Access stays `requireAuth()` (not `requireAdmin()`).
- Keep the existing single-flow structure (upload form + file list + download); no new CRUD grid, edit, or delete actions are introduced.
- Update the admin sidebar `uploads` nav item to point to the new `/admin/uploads` path.
- Colocate the uploads controller under the admin actions tree (`app/actions/admin/uploads/`) and re-wire it in `router.ts`.
- Add a breadcrumb route-label for `/admin/uploads` for parity with the other admin pages.
- Update the route-agent agent navigation prompt to `navigate('/admin/uploads')`.

## Capabilities

### New Capabilities

- `admin-uploads-route`: The uploads page (index + upload action) and its download endpoint are served under the `/admin` tree at `/admin/uploads` and `/admin/uploads/:id/download`, accessible to any authenticated user, with the old top-level `/uploads` and `/uploads/:id/download` URLs removed.

### Modified Capabilities

None — there is no existing uploads spec in `openspec/specs/`.

## Impact

- `app/routes.ts` — move `uploads` into the `admin` tree; relocate the download endpoint path.
- `app/router.ts` — re-map the uploads controller to `routes.admin.uploads` and its download handler to the new path.
- `app/actions/uploads/controller.tsx` — relocate to `app/actions/admin/uploads/controller.tsx`; update route/`system` references.
- `app/ui/admin-layout.tsx` — sidebar `uploads` nav item href → `routes.admin.uploads.index`.
- `app/route-labels.ts` — add an `/admin/uploads` breadcrumb label.
- `app/actions/mastra/agents/route-agent.ts` — navigation prompt `navigate('/uploads')` → `navigate('/admin/uploads')`.
- `app/data/uploads.ts` and `app/data/uploads.test.ts` — unchanged (path-independent data layer).
