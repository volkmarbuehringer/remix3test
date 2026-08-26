## Context

See `proposal.md` — Why. Today the uploads page is a top-level route `form('uploads')` at `/uploads`, mapped to `app/actions/uploads/controller.tsx` with `requireAuth()` (not `requireAdmin()`), already rendered inside the admin sidebar layout via `renderAdminPage`. Its download endpoint is `system.uploadsDownload` → `/uploads/:id/download`. The admin sidebar already lists an `uploads` nav item pointing at `routes.uploads.index`, and the route-agent navigation prompt calls `navigate('/uploads')`.

This design relocates the uploads route into the admin route tree (URL: `/admin/uploads`, download: `/admin/uploads/:id/download`) while preserving all current page semantics and access rules. It does not change the data layer (`app/data/uploads.ts` is path-independent).

## Goals / Non-Goals

**Goals:**
- Serve the uploads page at `/admin/uploads` (GET render + POST multipart upload) and the download at `/admin/uploads/:id/download`.
- Preserve existing semantics: `requireAuth()` (any authenticated user), admin sees all files, non-admin sees only files they own; single upload-form + list + download flow (no CRUD grid).
- Remove the old `/uploads` and `/uploads/:id/download` public paths entirely (no redirect/alias).
- Keep the admin sidebar "Uploads" entry, re-pointed to the new path, plus breadcrumb parity with `/admin/users`.

**Non-Goals:**
- Introducing edit/delete or a full resource grid (no `create`/`update`/`destroy` actions, no `admin-page-base` grid/validation contract).
- Restricting uploads to admins (no `requireAdmin()`).
- Any data/migration change to the `uploads` table.

## Decisions

### Decision 1: Route shape — nested `route()` group under `admin`

Define `uploads` inside the `admin` tree as:

```ts
uploads: route('uploads', {
  index: get('/'),
  action: post('/'),
}),
```

This yields `routes.admin.uploads`, `routes.admin.uploads.index`, and `routes.admin.uploads.action`, with public paths `/admin/uploads`. Removing the top-level `uploads: form('uploads')` entry (and `system.uploadsDownload`) is what deletes the old URLs.

- *Alternative considered*: keep `form('uploads')` nested under `admin`. `form()` is the shorthand used for simple top-level form routes (`settings`, `auth.login`); it expands to the same `index` (GET) + `action` (POST) pair. `route()` is chosen for consistency with the other admin resource groups (`users`, `lists`, `messages`) and keeps the two actions explicit. Either is behaviorally equivalent because the controller already keys actions off `index`/`action`.

### Decision 2: Download endpoint — nested under the admin uploads resource as a controller action

Add `download: get('/:id/download')` to `route('uploads', ...)`, producing `/admin/uploads/:id/download` (path-compatible with the chartlog/`users` convention that flat child routes are controller actions). The download handler is implemented as a `download` **controller action** rather than a standalone `createAction`: `createController` requires an action for every flat child route, so a bare `get('/:id/download')` child must map to an `actions.download` method (exactly as `users` nests `toggleDisabled`). This yields:

```
export default createController(routes.admin.uploads, {
  middleware: [requireAuth()],
  actions: { index, action, download },
})
```

- *Alternative considered*: keep the download as a separate `createAction` wired with `router.get(routes.admin.uploads.download, ...)`. This is rejected because `createController` rejects a flat child route with no matching action (typecheck error: "Property 'download' is missing"), so the download must live in the controller's action map.
- *Alternative considered*: keep the download key in `system` (`system.uploadsDownload`) and only change its literal path to `/admin/uploads/:id/download`. This works but leaves a top-level `system` key for a now admin-nested resource; nesting is chosen for cohesion. Either way the old path stops resolving.

### Decision 3: Controller colocation and router wiring

Move `app/actions/uploads/controller.tsx` → `app/actions/admin/uploads/controller.tsx` (feature colocation). Re-export the relocated controller from the admin entry point (the download is an action of that controller, so only the controller is re-exported):

```ts
// app/actions/admin/controller.tsx
export { default as adminUploads } from './uploads/controller.tsx'
```

Then update `router.ts` (drop the `./actions/uploads/controller.tsx` import) to map `routes.admin.uploads` → `admin.adminUploads`. No separate `router.get` for the download is needed — it is a controller action on the same route group.

- *Alternative considered*: import the relocated controller directly in `router.ts`. This is less consistent with how the other admin controllers are re-exported through `app/actions/admin/controller.tsx`.

The controller's action map becomes `index` + `action` + `download`; the route references change to `routes.admin.uploads`, `routes.admin.uploads.action`, and `routes.admin.uploads.download`. The `renderAdminPage(context.render, 'uploads', ...)` call stays the same (already admin-frame rendered).

### Decision 4: Nav + breadcrumb parity

- `app/ui/admin-layout.tsx`: change the `uploads` nav item from `route: routes.uploads.index` to `route: routes.admin.uploads.index`. The `AdminNavItem` union already contains `'uploads'`, so it is unchanged.
- `app/route-labels.ts`: add `[routes.admin.uploads.index.href()]: 'Uploads'` under the Admin group, matching the other admin pages. `ROUTE_LABELS` is consumed by `app/ui/breadcrumbs.tsx` to derive breadcrumbs, so this makes the relocated page's breadcrumb read "Uploads".

### Decision 5: Route-agent navigation prompt

Update `app/actions/mastra/agents/route-agent.ts` navigation protocol from `navigate('/uploads')` to `navigate('/admin/uploads')`. The `routeNavigate` tool does not validate against a route whitelist, so the prompt string is the single source of the agent's target path.

## Risks / Trade-offs

- [Breaking URL] Any external bookmarks/links to `/uploads` or `/uploads/:id/download` break — intended per the user's choice to remove the old URL entirely. → Mitigation: documented as **BREAKING** in the proposal; no redirect added by design.
- [Route shape divergence] If the nested `route()` shape does not expand the same way as `form()` did, the controller's `action` key might not map to the intended POST path. → Mitigation: the controller keeps its `index`/`action` keys; confirm with `npm run typecheck` and a GET/POST smoke request to `/admin/uploads`.
- [Stale agent path] A leftover `/uploads` in the route-agent prompt would leave the agent navigating to a 404. → Mitigation: `sed` the prompt and run a `grep -r "/uploads" app/` audit to confirm no residual literal path.
- [Breadcrumb change] Adding a route-label is a small behavior change, but it only improves breadcrumbs and does not alter the external contract. → Mitigation: drop that single task if unwanted; it does not affect the spec.
