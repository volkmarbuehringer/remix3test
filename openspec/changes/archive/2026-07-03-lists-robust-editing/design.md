## Context

The `/lists` feature is a personal scratchpad. Current shape:

- One DB row per list: `id, user_id, list(jsonb Array<{id,label}>), description, created_at, updated_at`.
- Two controllers share `app/lib/lists-api.ts`: session-auth `app/actions/lists/*` (the browser UI) and bearer-auth `app/actions/api/lists/*` (out of scope for this change).
- Browser UI = a `Frame`-based sidebar + content layout (`app/ui/lists-layout.tsx`) wrapping a `clientEntry` (`app/assets/lists-client.tsx`) that holds all editing state in memory and round-trips JSON to `save`, `update`, `rename`, `data`, `destroy` actions.
- `updated_at` is written but never _compared_, so concurrent edits silently overwrite.
- Item `id` is rewritten by `deleteItem`, so identity is positional, not stable.

Constraints:

- Remix 3, no React. Server-rendered components + clientEntry islands + Frame navigation.
- `remix/data-schema` for action body validation (`s.parseSafe`).
- `remix/data-table` for DB access (`db.findMany`, `db.findOne`, `db.create`, `db.updateMany`, `db.delete`).
- No new tables, no normalization. Items stay in the jsonb column.
- `/api/lists` is intentionally untouched; its parity drift is a separate, future change.

## Goals / Non-Goals

**Goals:**

- Stable item identity that survives delete/edit/drag.
- One resource-oriented write path: `POST /` (create) and `PATCH /:id` (partial update — description only, items only, or both).
- Loaded list data is delivered _with_ the `?load=N` frame response — no second `/data` fetch.
- Optimistic concurrency: stale writes return `409` with the current row; the user can choose to reload.
- Autosave on idle with a visible dirty/saving/saved indicator; manual Save/Update buttons become a non-default escape hatch.
- Sidebar search for users, reusing the existing `getAllLists({ filter })` path.
- Remove the dead `routes.lists.show` action and `show-page.tsx`.

**Non-Goals:**

- Normalizing items into their own table.
- Realtime multi-user/cross-tab collaboration (SSE, CRDT, diff/merge).
- Soft delete / trash / undo.
- Touching `/api/lists` in any way.
- Item-model expansion (checked, priority, due_at, tags, notes) — deferred; this change only stabilizes ids to _enable_ that future work, not to ship it.
- i18n — out of scope; existing German strings stay as-is, replaced where they are already replaced.

## Decisions

### D1. Item id is a server-issued stable string

**Choice:** On `create`, server assigns each item a stable string id (e.g., `crypto.randomUUID()` or `nanoid`-style base36). On `patch` with items, the server **preserves** ids for items that arrived with one and **assigns** a fresh id only to items the client sends without an id (newly added client-side). An item's id never changes for the lifetime of that item. Delete/reorder/edit operate by id, not by positional rewrite.

**Why not positional numeric ids (`(i+1).toString()`)?** That is the current bug — every delete rewrites every survivor's id, breaking React keys, future per-item references, and drag-mirror reconciliation.

**Why not a monotonic per-list counter managed by the server?** It requires either an extra column/sequence on `lists` or wrangling a `next_item_id` field inside the jsonb. UUID-per-item is stateless and self-contained in the array.

**Why string ids, not numbers?** jsonb keys/`item->>'label'` paths are string-native; the client already treats ids as strings; UUIDs are naturally strings. Keeps the existing `ListItem` shape (`{ id: string, label: string }`) unbroken.

**Alternatives considered:**

- Server-side monotonic counter — rejected: extra state to maintain.
- Client-generated uuids — rejected: the client could be wrong/stale; the server is the single source of truth on create.
- Keep numeric positional ids — rejected: it is the bug we are fixing.

### D2. PATCH is partial; minimal body shapes

**Choice:** `PATCH /lists/:id` accepts any non-empty subset of:

- `{ description: string }` — rename only.
- `{ items: Array<{id,label}> }` — replace items only.
- `{ description, items }` — both.

The server applies whichever keys are present, bumps `updated_at`, and returns the new row. Sending neither key is a `400`.

**Why not keep `update` (full replace) and a separate `rename`?** The split exists today only because the sidebar-rename client (`list-name-edit.tsx`) didn't want to ship the items array. With PATCH, that client simply sends `{ description }`. One endpoint serves both UXs, and we delete `rename`.

**Why full-replace for `items` (not per-item operations)?** Per-item ops would require per-item server actions, which in turn require either normalizing the table or treating the jsonb as an indexed collection you can address — both larger changes than this scope. Full-array `items` patch is the smallest step that still fixes the action-shape duplication. Per-item is enabled by D1 _for future changes_ but is not built now.

### D3. Optimistic concurrency via `If-Match: <updated_at>`

**Choice:** Every write sends `If-Match: <updated_at-when-loaded>`. The server compares against `lists.updated_at`:

- Match → apply, return updated row, response carries new `updated_at` in body + `ETag` header.
- Mismatch → `409 Conflict`, body = current row (so the client can prompt "reload and discard local" / "overwrite (force PUT with current updated_at)")

The client stores the loaded `updated_at` in a closure variable and refreshes it from every successful write response. On `409`, the client surfaces a small inline banner above the items list with two buttons: `Neu laden` (discard local, reload server state) and `Trotzdem speichern` (re-PATCH with the server's returned `updated_at`, i.e., force overwrite).

**Why `updated_at` (ms epoch) rather than a version column or row hash?** `updated_at` already exists and is bumped on every write. Adding a version column is a schema migration we explicitly want to avoid; a hash is more work for no benefit at this scale (single user, rare concurrent tabs).

**Why `If-Match` header instead of a body field?** Header is the HTTP idiom, keeps the body a clean resource representation, and is trivially ignored by the API path (which we're not touching) without schema churn.

**Trade-off:** Strict precondition means a user with two tabs _will_ hit 409 if both edit. That is the desired behavior — we are trading "silent loss" for "explicit conflict". Acceptable for a scratchpad.

### D4. Fold loaded-list data into the `?load=N` frame response

**Choice:** The `index` action, when `?load=N` is present and the list exists and is owned by the user, returns the shell _plus_ the loaded list's full row serialized into the initial `ListsClient` props (server-rendered as a JSON island or via a `data-` attribute / inline `<script type="application/json">`). The client `ListsClient` reads initial state from that payload on first render instead of fetching `/lists/N/data`. The `data` action is removed.

**Why not keep the `/data` fetch as a "warm-up" optimization?** It is the opposite — it adds a round-trip, requires its own auth path, and only exists because the original clientEntry didn't have a server-injected initial-state mechanism. The existing `programmatic-frame-reload` + `client-mounted-frames` patterns already support server-rendered initial props for clientEntry components; we use them.

**Why JSON-in-HTML rather than streaming the row through context?** The row is small (a description + a jsonb array). Serializing as a `<script type="application/json" id="...">` and reading it on init is the simplest, framework-idiomatic approach in Remix 3 and avoids touching the context plumbing.

**What if `?load=N` is missing or the list isn't found?** The client renders a fresh "new list" state (empty description, empty items), exactly as today's `activeItem === 'new'` branch does.

### D5. Autosave: debounced, dirty-aware, with manual escape hatch

**Choice:**

- A debounce timer (default 1500 ms) restarts on every change to `description` or `items`.
- State machine: `idle` → `dirty` (any change) → `saving` (PATCH in flight) → `saved` (settled ok) or `error` (network/4xx/5xx) → back to `idle`.
- The control bar shows a status pill (`Gespeichert` / `Speichern…` / `Ungespeichert` / `Fehler`). Buttons `Aktualisieren` and `Hinzufügen` remain but are visually de-emphasized and trigger an immediate flush of pending changes — the escape hatch for users who don't trust autosave.
- On `409`, autosave does **not** retry; the conflict banner (D3) takes over.
- On navigate-away (`handle.signal` aborts) with pending dirty state, fire a final flush using `sendBeacon` if a payload is queued, best-effort.

**Why keep manual buttons at all?** Autosave is new behavior; some scratchpad users _want_ to trust an explicit save. Demoting the buttons (not deleting them) preserves the existing muscle memory while removing the necessity.

**Why 1500 ms?** Long enough that typing continuously doesn't fire a write per keystroke; short enough that "I stopped typing and tabbed away" almost always saves before the user leaves.

### D6. Sidebar search reuses `getAllLists({ filter })`

**Choice:** The user sidebar gains a small `<input>` at the top (under the "Meine Listen" label). Typing into it updates `?filter=<value>` on the frame's `src` (debounced client-side ~250 ms). The `index` action already forwards `filter` to `getAllLists` — the parameter is parsed from `context.url.searchParams` (we add it; admin already passes it this way).

**Why not a separate search route?** The server already supports filter on the existing `index`; a new route would duplicate handling. Query-param-on-existing-route matches the admin pattern in this repo.

### D7. Dead `show` route removed

**Choice:** Delete `routes.lists.show`, the `show` action in `app/actions/lists/controller.tsx`, and `app/actions/lists/show-page.tsx`. Nothing in the UI links to it; the index owns display. Confirm via `grep` that no `routes.lists.show.href()` call sites exist before deletion.

## Risks / Trade-offs

- **Risk:** Server-issued item ids break any client-side code that still assumes numeric positional ids. → _Mitigation:_ The only consumers are `ListsClient` (rewritten in this change) and `list-name-edit.tsx` (does not touch item ids). Audit `grep -r 'item.id' app/` before merge.
- **Risk:** `If-Match` precondition is strict; users editing the same list in two tabs hit 409 often. → _Mitigation:_ This is desired (no more silent loss); the conflict UI offers single-click overwrite or reload. Acceptable for a personal scratchpad.
- **Risk:** Folding data into the frame response increases the `index` action's response size when `?load=N` is set. → _Mitigation:_ A list row is small (description ≤ 500 chars + jsonb items). Negligible vs. the saved round-trip.
- **Risk:** Autosave-on-navigate races with `sendBeacon`; some browsers don't honor custom headers on beacon. → _Mitigation:_ `If-Match` cannot be sent via beacon; for the navigate-away flush, send the precondition in the body as `_if_match` (server accepts either header or body field). Documented escape valve; not on the happy path.
- **Risk:** Removing the `data` action could break the API surface if anyone calls it. → _Mitigation:_ `routes.lists.data` is session-auth only and used solely by the client we are rewriting; `/api/lists` has its own `show` and is out of scope. A repo-wide `grep` confirms no other callers.
- **Risk:** PATCH with `items` only (no description) still ships the entire items array on every edit; payload grows linearly with list size. → _Mitigation:_ Acceptable for a scratchpad. Per-item server actions are a future change (enabled by D1's stable ids), explicitly out of scope here.
- **Trade-off:** We delete `renameList` and `updateList` from `lists-api.ts`. Admin's `app/actions/admin/lists/controller.tsx` uses `db.delete` only (not these helpers), so it is unaffected — confirmed by reading that controller.

## Migration Plan

Single-change deploy; no schema migration, no feature flag.

1. Ship `lists-api.ts` (`createList`, `patchList`, `deleteList`) and the rewritten controller in one commit.
2. Ship the rewritten `ListsClient` and `lists-layout.tsx` (initial-state hydration + sidebar search) in the same commit, so server and client move together.
3. Delete `show-page.tsx`, the `data` action, the `save`/`update`/`rename` actions, and their route entries in `routes.ts`.
4. Update tests (`lists-api.test.ts`, lists controller tests, lists-client tests) in the same commit.
5. Manual smoke: create, edit, drag, delete, rename (sidebar), concurrent-tab edit (expect 409 + reload UI), sidebar search.

Rollback: revert the single commit. No DB state to undo (schema unchanged). Existing list rows are fully compatible with both old and new code paths — the only difference is item id shape inside the jsonb, which is opaque to old code.

## Open Questions

- **Should the conflict UI offer "merge"?** No — a scratchpad edit is usually one focused action, merging is overkill. Single-button reload (discard local) or force-overwrite is enough. Merge can ship later if real users hit this often enough to want it.
- **Should autosave also fire when the user blurs the description input / adds an item?** Yes — debounce is restarted, but implicit triggers (blur, add-item) reset the debounce to a shorter 300 ms so the new item is persisted quickly. Capture in tasks; not a design-level decision.
