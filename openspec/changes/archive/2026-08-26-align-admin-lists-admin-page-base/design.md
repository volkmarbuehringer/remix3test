## Context

See `proposal.md` — Why. `/admin/lists` already renders through the shared admin sidebar frame (`renderAdminPage(context.render, 'lists', <AdminListsPage/>)`, `frames.adminContent`), uses `requireAuth()` + `requireAdmin()`, has a filter bar and pagination, and a `ConfirmDelete`-backed destroy. Its gaps relative to `/admin/users` are: no `create`/`update` routes or actions, no sort column/order or grid-state round-trip (`_offset/_sort/_order/_filter`), no `editing=`/`creating=` inline form panel, no server-side inline validation (create/update does not exist at all), destroyed-row non-field errors only handled as a bare `Invalid list ID` 400, and no empty-state create CTA. The requirements are in `specs/admin-lists-admin-base/spec.md`.

## Goals / Non-Goals

**Goals**

- Bring `/admin/lists` onto the same full admin CRUD / grid contract as `/admin/users` (`admin-page-base`): `create` + `update` + `destroy`, sort + filter + pagination, grid-state round-trip, 200 inline-error re-renders, `session.flash` + Post/Redirect/Get for non-field errors, server-rendered frame-targeted row actions, and an empty-state create CTA.
- Keep every mutation targeting only the `frames.adminContent` frame (no full-document navigation, no client-side mutation endpoints).
- Preserve the lists-specific shape: the admin form exposes only `title` and `description`; the jsonb `list` items array and the owning user stay managed through the public ListLab and are untouched by admin updates.

**Non-Goals**

- Do NOT port the public ListLab item-editing flows (`/lists` create/patch/move) into the admin page; the admin form does not edit the `list` items array.
- Do NOT add a `toggleDisabled` action — lists have no disabled state (users does).
- Do NOT add a right-click context menu; the base contract requires server-rendered frame-targeted row actions, and a context menu is an additive client enhancement that is out of scope here.
- Do NOT change `admin-page-base` itself, nor the public `lists-editing`/`lists-search` specs.

## Decisions

### D1. Add create + update and align the destroy verb in the route map

Extend the `admin.lists` route map from `{ index, destroy }` to `{ index, create, update, destroy }`, and change `destroy` from `post('/:id/delete')` to `del('/:id')`. The delete action becomes a `RestfulForm method="DELETE"` targeting the frame, exactly as `/admin/users` renders its row delete. Rationale: matches `/admin/users` verb-for-verb; the base contract wants a server-rendered destructive form. Alternative considered: keep `post('/:id/delete')` to avoid a breaking verb change — rejected because it diverges from the "same level as users" target and complicates the shared row-action pattern. This is a documented **BREAKING** route change.

### D2. Index reads grid state and switches editing/creating modes

Replace the manual `offset`/`filter` read with the grid-state helpers, and adopt the `admin-urls.ts` `sort`/`order`/`filter`/`editing`/`creating` URL convention that `/admin/users` uses: `parseSort` over `SORTABLE_FIELDS = ['id','title','description','created_at','updated_at']` (default column `created_at`, default direction `desc` to match the current `created_at desc` ordering), plus `?editing=<id>` (load `editRow`) and `?creating=true`. Rationale: the same controller/page shape as `/admin/users`, making the parity explicit and reusing the proven grid-state helpers.

### D3. Validation failures re-render at 200 via the shared grid-error adapter

Create a thin `renderListsError` adapter (mirroring `renderUsersError`) that binds the `AdminListsPage` component and calls `renderGridFormError` so create/update schema failures (empty `title`, over-long `description`) re-render the target frame at status 200 with `formValues` + `fieldErrors` + the current grid state. Rationale: the frame transport treats a non-OK fragment as an unrecoverable error card; the base contract requires an OK inline-error fragment. Alternative (return 400) rejected — diverges from `/admin/users`.

### D4. Non-field errors move to session.flash + PRG

Add a `listsGridUrl(formData)` helper (mirroring `offeringsGridUrl`/`resourcesGridUrl`) building the grid URL from `gridStateToParams(gridStateFromFormData(formData))`. Replace the current bare `Invalid list ID` 400 response, and the update/destroy invalid-or-missing-id guards, with `context.session.flash('error', msg)` + `redirect(listsGridUrl(formData))`. Rationale: the base contract forbids non-OK JSON and `?error=` for frame-targeted mutations; flash surfaces through the existing admin banner.

### D5. Server-rendered frame-targeted row actions and empty-state CTA

Add a visible action cell to the lists table (a `buildEditUrl` edit link and a `RestfulForm method="DELETE"` per row, both carrying `data-rmx-target={frames.adminContent}` and a `GridStateHiddenInputs` with the current grid state). Add the empty-state `Neu anlegen` CTA when `rows.length === 0` and no form panel is active (`!hasFormPanel`, where `hasFormPanel = Boolean(editRow || creating)`). Rationale: mirrors `/admin/users` and the base-contract requirement that row actions are server-rendered and frame-targeted, and that an empty grid is not a dead end.

### D6. Admin form edits title/description only; create defaults items

The create/update forms submit only `title` (required, min length 1) and `description` (optional). On `create`, the controller inserts the row with `list` defaulting to `[]` and no owning user (the schema's `beforeWrite` sets `created_at`/`updated_at`). On `update`, the controller updates only `title` and `description` (`updated_at` bumped by `beforeWrite`), never touching the `list` column or `user_id`. Rationale: keeps admin item editing out of scope (per proposal) while still allowing full title/description management.

### D7. No GET /:id — mirror /admin/users

The inline edit panel lives on the index via `?editing=<id>`, and the update form posts `PUT /admin/lists/:id`, same as `/admin/users`. Unlike the verwaltung resources page, `/admin/lists` does not add a `show` GET `/:id`; the reference (`/admin/users`) has none and is the parity target. If a live frame check shows the committed `:id` action path is GET after a PUT/DELETE, add a `show` GET `/:id` that PRGs to the grid (the verwaltung fix) — see Open Questions.

## Risks / Trade-offs

- [**Breaking route change**] `destroy` moves from `POST /admin/lists/:id/delete` to `DELETE /admin/lists/:id`. Any external caller of the old verb breaks. → Mitigation: this is the only consumer and it is rendered by the page; the route contract change is intentional and documented (proposal marks it **BREAKING**). Update any test that posts to the old path.
- [**New test surface**] No controller test currently exists for `/admin/lists`. → Mitigation: add `app/actions/admin/lists/controller.test.ts` in the same change covering the conformance contract (200 re-renders, flash PRG, grid-state preservation, DELETE verb, sort/filter round-trip).
- [**Items preservation regression risk**] If the update action naively writes all submitted columns, the jsonb `list` array could be wiped. → Mitigation: D6 explicitly updates only `title`/`description`; covered by a test asserting the items array is unchanged after an admin update.
- [**Frame-address GET :id unresolved**] Unknown until verified against `/admin/users`. → Mitigation: see Open Questions; the fix (a `show` GET `/:id`) is additive and localized if needed.

## Migration Plan

1. Routes (`app/routes.ts`): add `create` (`post('/')`) and `update` (`put('/:id')`) to the `admin.lists` map; change `destroy` to `del('/:id')`.
2. Controller (`app/actions/admin/lists/controller.tsx`): extend the index to read grid state + `editing`/`creating`; add `create` and `update` actions (validated via `s.parseSafe`, 200 re-render via the new `renderListsError`/`renderGridFormError`, PRG + grid state on success); convert destroy to grid-state PRG + `session.flash` for non-field errors; add `listsGridUrl(formData)`.
3. Page (`app/ui/admin-lists-page.tsx`): sortable column headers, inline create/edit `RestfulForm` panel, `GridStateHiddenInputs`, the visible frame-targeted action cell, and the empty-state CTA.
4. Tests (`app/actions/admin/lists/controller.test.ts`): cover the contract above.
5. Run `npm test`, `npm run typecheck`, `npm run format:fix`.

Rollback: all changes are localized to `routes.ts`, the lists controller/page, and the new test. Revert the single commit to restore the prior index+delete behavior; the route-verb change is the only externally visible break.

## Open Questions

- **Does the frame GET the committed `:id` after a PUT/DELETE on `/admin/lists`?** `/admin/users` has no `show` GET `/:id` and is the parity target. If a live check shows the frame GETs `/admin/lists/:id` after a mutation and renders a 404, add a `show` GET `/:id` that PRGs missing/deleted rows to the grid (the `verwaltung-resources-admin-base` fix). Deferred because it is additive and localized, and it does not change the specs or the task breakdown.
- **Sort default direction** defaults to `desc` on `created_at` to match today's ordering; confirm that is the preferred default for the sortable headers.
