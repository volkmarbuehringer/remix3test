# Bulk list actions and an API-backed target picker

**Extracted:** 2026-10-18
**Context:** The /lists editor (`remix` 3.0.0 / `@remix-run/component` 1.0.0, build `7f900151`). Bulk copy read candidate targets from the rendered sidebar (`[data-list-id]`), so a target on another sidebar page was unreachable; bulk move did not exist; the list merge still used `window.confirm`. This is the replacement: server-searched targets, atomic bulk move, single-row non-drag alternatives, and the shared styled confirm dialog.

## Problem

- **The sidebar is a 15-row window, not a target list.** `copyTargets()` scanned `[data-list-id]` on the current page. A list outside the current offset/filter could not be chosen, and the picker silently disagreed with the server about what exists.
- **`/api/lists` is not callable from the browser session.** It is bearer-token-only (`apiTokenAuth`) and `/api/*` skips CSRF. Adding session auth there would turn every API write into a cookie-authenticated CSRF surface. The authenticated page route needs its own JSON branch/action.
- **Sequential bulk moves race their own precondition.** Every `POST /lists/:id/move` bumps the source's `updated_at`; a client loop must re-read If-Match after each response and still leaves a partial move on failure.
- **A `window.confirm` merge blocks and cannot be styled**, while the delete path already had `requestConfirm`.
- **A fixed confirm dialog inside the sticky sidebar is trapped in that stacking context.** After a list-to-list drag, the editor section painted above the dialog and swallowed its clicks. The delete-only path masked this because it was not preceded by a drag.
- **Bulk done/open must include hidden selected rows.** Selection deliberately survives filters (see `view-only-list-controls.md`), so acting only on `visibleItems()` silently skips rows the label says are included.

## Solution

### Bulk done/open

Keep the selection as the source of truth, snapshot the whole array, and apply the change to every selected id:

```ts
let setDoneSelected = (done: boolean) => {
  let ids = new Set(items.filter((item) => selectedItemIds.has(item.id)).map((item) => item.id))
  if (ids.size === 0) return
  showUndo(done ? 'bulkDone' : 'bulkOpen', cloneItems(items))
  items = setDoneByIds(items, ids, done, Date.now())
  setDirty()
  scheduleAutosave(true)
}
```

Add the new `UndoKind` labels to the undo chip; the snapshot restores the pre-bulk arrays, and the selection may stay checked (the user can immediately re-act on the same rows). Do not act on `visibleItems()` here.

### Atomic bulk move

Prefer one server route over a client loop:

- data: `moveItemsBetweenLists(db, sourceId, targetId, itemIds, userId, { expectedUpdatedAt })` in one `db.transaction`; lock both rows in id order, reject the whole request if any id is missing, remove all selected ids and append them to the target in source order.
- route: `POST /lists/:id/move-items` with `{ targetId, itemIds }` and the same `If-Match` requirement as `/move`.
- client API: `moveItemsRequest()` returns `{ source, target, moved }`; apply `source.items`/`source.updated_at` locally and sync the target sidebar row instead of reloading the whole frame.

Single-item moves keep using `POST /lists/:id/move`; the row menu passes that one id, so the existing endpoint stays the narrow contract.

### Session-authenticated target search

Add `GET /lists/targets?filter=&limit=&offset=` on the authenticated `lists` route map (not `/api/lists`). It reuses `getListSummaries` (title/description/item-label ILIKE search + pagination) and returns only `{ id, title, description, count, doneCount, updated_at }`. The client filters out its own list and keeps the last request id so a slow response cannot overwrite a newer search:

```ts
let requestId = ++pickerRequestId
let outcome = await searchListTargetsRequest(query)
if (requestId !== pickerRequestId) return
```

Picker details:

- Debounce typing ~250 ms; show loading immediately, then empty/error (with a retry) or the option buttons.
- The search input is uncontrolled (`defaultValue`) and updated through `on('input')`; a controlled value would fight the re-render in this runtime.
- Options are real `<button type="button" data-target-option="…">` elements, at least 44px tall. ArrowDown/ArrowUp walk them from the search input; Escape closes and restores focus.
- Focus the search after opening with `handle.queueTask(...)` **then** `handle.update()` (queue first, update after). Calling update first can drain the queue before the task exists.
- Invalidate the request id and clear the debounce timer on close so a late response cannot reopen the dialog.
- Use the same picker for bulk copy, bulk move, and the single-row move action.

### Non-drag alternatives (WCAG 2.5.7)

- Row menu: "In Liste verschieben" opens the picker for that one item and calls the per-item move route.
- Sidebar row menu: "Elemente hierher kopieren" calls the same `POST /lists/:id/merge` the list-to-list drag uses. It is wired from the editor client entry (it has `flushNow`/`getCsrfHeaders`), reads the target id from `[data-list-id]`, and confirms both list names before the request.
- Keep the selection/copy path; label bulk copy/move with the target name and announce success in the live region plus the notice row.

### Styled merge confirmation

Extend the existing confirm module with a promise variant:

```ts
export function requestConfirmDecision(detail: ConfirmRequestOptions): Promise<boolean> | null
```

It returns `null` when no `<ConfirmDelete />` is mounted, so the merge drag can fall back to `window.confirm` in headless/unit tests. Pending confirms get `title`, `confirmLabel`, and `tone` (defaults keep the delete dialog unchanged); cancelling calls `onCancel` so an awaited decision resolves `false`.

**Mount the dialog outside the sticky sidebar** (direct child of the page grid, still inside the render tree). `position: sticky` creates a stacking context; a `position: fixed` overlay inside it is painted with the sidebar and can sit under the editor content, which Playwright reports as "element intercepts pointer events" only after a drag.

## Verify

- Browser: bulk done/open including a hidden selected row + undo label; picker loading/empty/error/retry, debounced search, ArrowDown/Escape/focus restore; single-row move uses `/move`; bulk move uses `/move-items` with the hidden id in the body.
- Server: batch move success (order preserved), partial-id rejection leaves both lists untouched, stale If-Match conflict; `/lists/targets` searches description and item labels and requires auth.
- E2E: drag merge clicks the styled `Kopieren` button; sidebar "Elemente hierher kopieren" names both lists and appends once; copy picker searches the real `/lists/targets`.
- Geometry: 390x844 and 1440x900 remain overflow-free; 44px picker/search targets.

## Related

- `view-only-list-controls.md` — hidden selections and why bulk actions must include them.
- `touch-row-action-menu.md` — focus restoration and `queueTask` ordering.
- `queuetask-over-raf.md` — why the post-open focus is a task, not `requestAnimationFrame`.
- `remix3-server` § Security — `/api/*` skips CSRF, so session endpoints live on the authenticated page route.
