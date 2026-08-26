## Why

`/admin/users` is the canonical full admin CRUD page conforming to the shared admin page/form base contract (`admin-page-base`): server-rendered frame-targeted row actions, Post/Redirect/Get mutations, validation failures re-rendered as a 200 inline-error fragment, non-field errors surfaced via `session.flash` + PRG, and grid-state round-trip on every mutation. `/admin/lists` still drifts from that state — it exposes only an index (with an ad-hoc `offset`/`filter` read) plus a delete, with no create/edit, no sort, no grid-state round-trip, and no inline validation. Its mutations therefore behave differently from the canonical base contract and from `/admin/users`.

## What Changes

Bring `/admin/lists` to the same level as `/admin/users` by conforming it to the `admin-page-base` contract:

- **Add full admin CRUD**: add `create` (POST `/`) and `update` (PUT `/:id`) to the `admin.lists` route map and controller, and align `destroy` to `DELETE /:id` (**BREAKING** verb change from `POST /:id/delete`) rendered as a server-rendered frame-targeted form. Lists have no "disabled" state, so the users `toggleDisabled` action is intentionally not added.
- **Index gains grid state**: `sort`/`order/`offset`/`filter` round-trip, the `editing=<id>` inline edit panel, and the `creating=true` create panel — replacing the current manual `offset`/`filter` read.
- **Validation becomes 200, not 400**: create/update failures re-render the targeted admin content frame at status 200 carrying `formValues` + `fieldErrors` (via the shared `renderGridFormError` adapter), so the frame shows inline errors and preserved values instead of the frame transport's non-OK error card.
- **Non-field errors switch to `session.flash` + PRG**: invalid/missing row-id guards redirect back to the grid and surface the message via flash, preserving grid state.
- **Row actions become server-rendered and frame-targeted**: visible per-row edit link (frame-aware `?editing=<id>`) and DELETE form (with `data-rmx-target={frames.adminContent}`), plus an empty-state `Neu anlegen` CTA when no rows and no form panel are active.
- **Admin edits only `title`/`description`**: the jsonb `list` items array stays managed through the public ListLab (`/lists`); the admin create/update form does not expose item editing.

## Capabilities

### New Capabilities

- `admin-lists-admin-base`: the `/admin/lists` CRUD page conforms to the shared admin page/form base contract — server-rendered frame-targeted row actions, Post/Redirect/Get mutations, validation failures re-rendered as a 200 inline-error fragment, non-field errors surfaced via redirect + `session.flash`, and grid-state round-trip on every mutation — while keeping the `title`/`description` fields and leaving the jsonb `list` items array to the public ListLab.

### Modified Capabilities

- (none) — the `admin-page-base` contract itself is unchanged; `admin-lists-admin-base` is a new conformance capability. The public-ListsLab specs (`lists-editing`, `lists-search`) describe the session-auth `/lists` route and are unaffected.

## Impact

- **Code**: `app/routes.ts` (add `create`/`update` to the `admin.lists` map, change `destroy` to `del('/:id')`); `app/actions/admin/lists/controller.tsx` (index sort/grid-state + editing/creating modes, new `create`/`update` actions with `renderGridFormError` 200 re-render, `destroy` grid-state PRG + flash for non-field errors); `app/ui/admin-lists-page.tsx` (sortable headers, inline create/edit `RestfulForm` panel, `GridStateHiddenInputs`, visible frame-targeted row actions, empty-state CTA).
- **Contract/API**: the `/admin/lists` mutations become PRG + flash instead of bare redirects; create/update add expected POST/PUT surfaces; destroy moves from `POST /:id/delete` to `DELETE /:id` (**BREAKING**).
- **Systems**: no new dependencies — reuses the shared `RestfulForm`, `GridStateHiddenInputs`, `grid-state.ts`, `admin-urls.ts` helpers, `renderGridFormError`, `parseSort`, and the frame transport already used by `/admin/users`.
- **Tests**: add `app/actions/admin/lists/controller.test.ts` asserting 200 inline-error re-renders, PRG + `session.flash` for non-field errors, grid-state preservation on create/update/destroy redirects, the destroy `DELETE` verb, and the sort/filter/pagination round-trip.
