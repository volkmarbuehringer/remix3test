## Why

The `/lists` editing surface has accumulated real correctness gaps for a personal-scratchpad product: item identity churns on every delete (breaking keys and future item-level features), every edit is a blind full-array PUT with last-writer-wins (silent data loss across tabs), the client pays a redundant `/data` round-trip on every load, save/rename semantics split into three overlapping endpoints, and the sidebar's manual Save/Update buttons ask the user to track dirty state that the app could track itself. These are the foundational issues that block any future item-level work; fixing them now is cheap and removes the worst smells without expanding scope.

## What Changes

- **Stable item ids.** Items keep a server-issued id for their lifetime; delete/edit/drag no longer rewrite sibling ids. `nextId` derivation collapses to a single rule (max existing numeric id + 1, or a fresh id on create).
- **Single resource-oriented action shape.** Replace `save`, `update`, `rename`, `data` with: `create` (POST `/`), `patch` (PATCH `/:id` accepting a _partial_ body — `{ description? }`, `{ items? }`, or both), and keep `destroy`. **BREAKING** for any in-flight client calls; the only known consumer is this app's own client, which we are rewriting in the same change.
- **Fold loaded list into the frame response.** The `?load=N` GET returns the shell _and_ the loaded list's data in the same response (server-rendered into the `ListsClient` initial state), eliminating the second `/lists/N/data` fetch. The `data` action is removed.
- **Optimistic concurrency.** Every write sends `If-Match: <updated_at>` (derived from the loaded list's `updated_at`); the server rejects stale writes with `409 Conflict` and returns the current row. The client shows a small "conflict — reload?" affordance on 409. `updated_at` becomes a real precondition, not just a timestamp.
- **Autosave with dirty indicator.** Replace the manual Save / Aktualisieren buttons with a debounced autosave that fires on idle (description or items changed). The control bar shows a status pill: `Gespeichert` / `Speichern…` / `Ungespeichert`. Manual buttons stay only as a non-default escape hatch.
- **Sidebar filter for users.** The user sidebar gains a search input that drives `getAllLists({ filter })` over the existing `description ILIKE` + jsonb `item->>'label' ILIKE` path. Admin already had this; we are wiring the same parameter into the user view.
- **Dead-route cull.** Remove `routes.lists.show`, the `show` action, and `app/actions/lists/show-page.tsx`. Nothing in the UI routes to it; the index owns display entirely.

## Capabilities

### New Capabilities

- `lists-editing`: The canonical `/lists` editing surface — stable item identity, single PATCH-based action shape, server-folds-loaded-data into the frame, optimistic concurrency via `updated_at`, autosave with dirty-state indicator, and dead `show` route removal.
- `lists-search`: User-sidebar search/filter for lists, reusing the existing `getAllLists` `filter` parameter against description and item labels.

### Modified Capabilities

<!-- None. The change is self-contained to the lists feature and does not change spec-level requirements of cross-cutting capabilities like client-mounted-frames or programmatic-frame-reload — those patterns are being *used*, not redefined. -->

## Impact

- **Code:**
  - `app/routes.ts` — `lists` route map: drop `save`, `update`, `rename`, `show`, `data`; add `create`, `patch`. `apiLists` is explicitly out of scope for this change (left as-is).
  - `app/router.ts` — controller wiring unchanged in shape; new controller exports from `app/actions/lists/controller.tsx`.
  - `app/actions/lists/controller.tsx` — rewrite actions: `index` (folded-data variant), `create`, `patch` (with `If-Match` precondition + 409), `destroy`. Remove `save/update/rename/data/show` actions.
  - `app/actions/lists/show-page.tsx` — **deleted**.
  - `app/lib/lists-api.ts` — replace `createList`, `updateList`, `renameList` with `createList`, `patchList(db, id, partial, { expectedUpdatedAt })`. `patchList` checks `updated_at`, returns `{ ok: true } | { ok: false, reason: 'not_found' | 'conflict', current?: ListRow }`.
  - `app/assets/lists-client.tsx` — rewrite: stable id helper, server-supplied initial state (no `/data` fetch), `If-Match` on writes, 409 → conflict UI, debounced autosave, dirty-state pill, fetch-reroute to `POST /` and `PATCH /:id`.
  - `app/assets/list-name-edit.tsx` — sidebar rename rerouted to `PATCH /:id` with only `{ description }` and the current `If-Match` value; keep the inline-edit UX.
  - `app/ui/lists-layout.tsx` — pass loaded list data (when present) down to `ListsIndexPage`/`ListsClient` for initial hydration; add the sidebar search field; hide the manual Save/Update buttons (or keep as a non-default escape hatch).
  - `app/ui/admin-lists-page.tsx` — unaffected functionally; its destroy/links stay. (Admin already uses its own controller; only the shared `lists-api.ts` change touches it, and `patchList`'s precondition is optional.)
- **API/contract:** Internal `/lists/*` action paths change. `/api/lists/*` is intentionally unchanged in this change (parity drift acknowledged, deferred).
- **Schema/migrations:** None. The `lists` table already has `updated_at`; no new columns, no normalization. Item `id` stability is a client + write-path convention, not a DB constraint.
- **Tests:** `app/lib/lists-api.test.ts` grows cases for `patchList` partial writes, conflict, not-found; existing `createList/updateList` tests rewritten. New client-level tests for autosave debounce and 409 handling.
- **Dependencies:** None new.
