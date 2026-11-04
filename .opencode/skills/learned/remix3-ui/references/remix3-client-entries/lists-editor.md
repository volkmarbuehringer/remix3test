# The `/lists` editor: view state, undo/autosave, bulk actions, and touch controls

**Extracted:** 2026-10-18; folded from four app-specific playbooks 2026-11-04.
**Revalidated:** 2026-11-04 against the current `/lists` implementation.
**Context:** `/lists` is this app's densest client entry. The traps below are app-specific; vendor guides do not cover them. Code: `app/actions/lists/public/lists-client.tsx` (state, undo, saves, picker, menus), `lists-view.tsx` (markup), `lists-state.ts` (pure view pipeline), `lists-styles.ts`, `lists-api.ts`, `lists-drag.ts`, `lists-row-actions.tsx` (server-sidebar menu entry), `app/ui/lists-layout.tsx` (sidebar query/form/markup), `app/ui/confirm-delete.browser.tsx`, `app/data/lists.ts`, `app/actions/lists/controller.tsx`.

## When to use

- A list view has status/hide-done/search filters or a view-only sort, and the persisted manual order must not change.
- Undo must survive a debounced PUT, or a list switch must not carry the snapshot to another list.
- A touch row needs a kebab/inline menu instead of a hover cluster, or focus is lost after a transient menu closes.
- Bulk actions span rows a filter hides, or targets live beyond the rendered sidebar page.
- Sidebar search/sort/page-size/result-count must survive navigation, or a fixed dialog sits inside the sticky sidebar.

## 1. View state stays out of the persisted model

- Keep `statusFilter`, `hideDone`, `sortMode` (`manual|az|done|due|updated`), `reverseView`, and `shuffleOrder` in the client closure. None of them call `setDirty()` or `showUndo()`: a one-shot sort that rewrote `items` and autosaved was unrecoverable once the undo chip expired. Only an explicit drag/keyboard/menu reorder mutates the array.
- One pure pipeline: `buildVisibleItems(items, { query, status, hideDone, sort, reverse, shuffleOrder })` = `filterItems` → `filterItemsByStatus` → `orderViewItems`. `manual` returns a copy and every transform runs on that copy, so the input array is untouched; `shuffleOrder` ranks ids and keeps unknown ones last (`lists-state.test.ts`).
- Status counts follow the text/tag filter but not the status tab: `countItemsByStatus(filterItems(items, listFilter))`. Overdue means open and due before today (done never counts). While hide-done is active and the done tab is not selected, the `Alle` badge shows the open count so it matches the rows.
- Hide-done is independent of the tabs. Selecting `Erledigt` clears hide-done, otherwise the explicit done tab could be silently emptied.
- Selection persists across filters: `selectedItemIds` may point at hidden rows. The bulk bar renders `N ausgewählt (inkl. X verborgener)`, labels bulk done/open/delete/copy as including hidden rows, switches the select-all label to `Sichtbare abwählen` while hidden rows stay selected, and uses the full `items` for the progress counter, not `visibleItems()`.
- The filtered empty state renders `Filter zurücksetzen`, which clears text + status + hide-done (not the view sort). The unfiltered empty state has its own message and CTA (§8).
- The `sortMode` select is uncontrolled. `syncSortSelect()` writes the DOM value from state in the change handler and after load; a controlled `value` fights the re-render (same reflection trap as the metadata selects). A visible `Ansicht` badge plus a title states that the order is not persisted.
- `resetViewState()` clears all five view fields in `hydrateFromInitialState` and in both no-initial-state branches of `reloadFromFrame` (restored draft, empty new list), so a status/sort cannot leak into the next list.

## 2. Two reorder locks: array-adjacent vs visible-step

- `reorderLocked() = filterActive() || statusFilter !== 'all' || hideDone || viewOrderActive()` gates **array-adjacent** moves: drag start, keyboard grab/quick-move, `moveItem`, and the row's `draggable` (`rowDraggable`).
- `visibleReorderLocked() = filterActive() || statusFilter !== 'all' || viewOrderActive()` gates the **↑/↓ buttons and touch menu actions** (`rowMovable`). Hide-done alone does not lock them: `moveVisibleStep` swaps the row with its nearest *visible* neighbour, so hidden done rows keep their slots and the visible order changes by exactly one step.
- Hide reorder actions, not just disable them: `rowMovable = !visibleReorderLocked()` hides the menu entries and the desktop cluster; the mutation functions re-check the lock as defense in depth.
- Disable ↑/↓ at the **visible** boundaries (`index === 0`, `index === vis.length - 1`), never at `realIndex === 0` / `items.length - 1`: a hidden done row can precede or follow the visible subset.
- Before deleting, compute the next/previous **visible** id, then focus it; otherwise focus lands on a hidden or removed row.

## 3. Undo, autosave, and source pinning

- Undo is the last destructive action, not a timer. `showUndo(kind, snapshot)` stores the snapshot and sets `keepUndoForMutation = true`; the immediately following `setDirty()` consumes it instead of clearing. Any other mutation clears the chip; autosave must not.
- Bind Ctrl/Cmd+Z on `document`: ignore Alt/Shift, other keys, and events targeting `input, textarea, select, [contenteditable]` (native text undo stays). With no snapshot, do nothing. No redo; document the policy in the chip title and the help sheet.
- `resetUndoState()` (clears the fields without rendering) on a list switch: `hydrateFromInitialState` **and** both no-initial-state branches (restored draft, empty new list). Do not call `clearUndo()` there if its `handle.update()` renders during hydration. A snapshot that outlives a frame navigation makes `undo()` write list A's items into list B under B's `If-Match` (silent data loss).
- Drifted save: when a PUT response drifts (live state no longer equals what was sent), rebase the clean baseline onto the server echo (`cleanTitle`/`cleanDescription`/`cleanItemsJSON` from `state`), set `dirty`, and re-arm autosave. Do **not** call `snapshotClean()`: the server holds the sent state, and an undo during the in-flight PUT restores exactly the old clean state, so a snapshotClean baseline would skip the follow-up save.
- Pin async target actions to their source list: capture `sourceId = loadedListId` before `flushNow()`, pass it to the request, and check `loadedListId === sourceId` after every await and again before applying `outcome.source`. Applies to bulk copy, bulk move, single-row move, and the sidebar copy-here confirm (capture the id at confirmation time, not inside `run()`). A stale response otherwise replaces list B's editor, and `snapshotClean()` marks B clean with A's content.
- Deterministic reproduction of the undo-during-PUT race: `app/actions/lists/public/lists-autosave.test.browser.tsx` holds the first PUT with a deferred fetch, undoes while it is pending, releases it, then advances fake timers for the re-armed save. `Response.json()` resolves through real browser tasks, so capture the real `setTimeout` before `t.useFakeTimers()` and flush a few 0 ms tasks (`flushAsyncWork`); fake timers alone leave the save unsettled.
- Autosave is the default; the header `Speichern` button is the quiet secondary escape hatch and is disabled while clean. A keepalive flush (`flushWithKeepalive`) runs from the frame's `reloadStart` and `beforeunload`, so switching lists does not discard a pending debounce.

## 4. Bulk actions and the styled merge confirm

- Bulk done/open: snapshot the whole `items` array, map the selection to ids over full `items` (not `visibleItems()`), apply `setDoneByIds`, `setDirty`, fast autosave, and show the `bulkDone`/`bulkOpen` undo. The selection may stay checked so the user can re-act. Call `disarmClear()` first: a bulk mutation must reset a previously armed two-step destructive action.
- Atomic multi-item move: one server route, not a client loop. `moveItemsBetweenLists(db, sourceId, targetId, itemIds, userId, { expectedUpdatedAt })` runs in one `db.transaction`, locks both list rows in id order, rejects the whole request if any id is missing, removes all selected ids, and appends them to the target in source order. Route `POST /lists/:id/move-items` with `{ targetId, itemIds }` keeps the same `If-Match` contract as `/move`. Client `moveItemsRequest()` returns `{ source, target, moved }`; apply `source.items`/`source.updated_at` locally and patch the sidebar row (`syncSidebarState`/`syncSidebarRow`) instead of reloading the frame. Single-item moves keep `POST /lists/:id/move` — the row menu passes one id, so the narrower endpoint stays the contract.
- Non-drag alternatives (WCAG 2.5.7): the row menu's "In Liste verschieben" opens the picker for one item and uses `/move`; the sidebar row's "Elemente hierher kopieren" calls the same `POST /lists/:id/merge` as the drag. The copy-here action is wired from the editor entry (it has `flushNow`/`getCsrfHeaders`), reads the target id from `[data-list-id]`, and confirms both list names before the request.
- Styled merge confirm: `requestConfirmDecision(detail)` returns a promise, or `null` when no `<ConfirmDelete>` is mounted so headless/unit paths fall back to `window.confirm`. Pending confirms accept `title`/`confirmLabel`/`tone`; cancel calls `onCancel` so an awaited decision resolves `false`.
- Mount the fixed dialog **outside** the sticky sidebar (a direct child of the page grid, still inside the render tree). `position: sticky` creates a stacking context; a `fixed` overlay inside it is painted with the sidebar and can sit under the editor content. Playwright only reports "element intercepts pointer events" after a drag, so a delete-only check misses this.

## 5. Session-authenticated target picker

- Do not call `/api/lists` from the session UI: it is bearer-token-only and `/api/*` skips CSRF; adding session auth there would make every API write a cookie-authenticated CSRF surface. Add `GET /lists/targets?filter=&limit=&offset=` on the authenticated `lists` route map, reusing `getListSummaries` (title/description/item-label search + pagination) and returning only `{ id, title, description, count, doneCount, updated_at }`.
- The picker filters out the loaded list and keeps `pickerRequestId`; a slower earlier response must not overwrite a newer search (`if (requestId !== pickerRequestId) return`).
- Debounce typing ~250 ms; show loading immediately, then empty/error (with retry) or the option buttons. The search input is uncontrolled (`defaultValue`) and updated through `on('input')`; a controlled value would fight the re-render.
- Options are real `<button type="button" data-target-option>` elements at least 44px tall. ArrowDown/ArrowUp walk them from the search input; Escape closes and restores focus.
- Post-open focus: `handle.queueTask(...)` **then** `handle.update()` — calling update first can drain the queue before the task exists. Same ordering after a close that restores focus.
- On close, bump `pickerRequestId` and clear the debounce timer so a late response cannot reopen the dialog. One picker serves bulk copy, bulk move, and single-row move.
- Label bulk copy/move with the target name and announce success in the live region and the notice row.

## 6. Touch rows and the inline menu

- Hide the view-mode hover cluster with `display: none` under `@media (hover: none), (max-width: 900px)` (not `opacity: 0`) so it leaves layout and the tab order, and show one kebab per row. `(hover: none)` alone is not enough: a narrow mouse window still matches `hover: hover`, so the row kept the 10rem right gutter and collapsed the label to 2px at 390px. Release the gutter in the same combined query. The kebab is 36px in compact pointer mode and 44px on touch; keep the touch-only 44px override on `(hover: none)`.
- Row: `flex-wrap: wrap`; menu: `flexBasis: 100%`, `display: grid`, `gridTemplateColumns: 1fr 1fr`, 44px actions. Edit mode keeps its own save/cancel cluster (`position: static; width: 100%` on `(hover: none), (max-width: 900px)`) with the editor `flexBasis: 100%` so the textarea and metadata fields get the full width. Keep the drag grip on hover-capable devices only (HTML5 drag cannot start from touch).
- An absolutely positioned menu inside the scrolling element list clips near the top/bottom; the inline menu cannot be clipped by the list's `overflow-y: auto`.
- Kebab: `aria-expanded={menuOpen}` and an `aria-label` naming the item; menu `role="group"` with an `aria-label`; focus the first action when it opens. Boolean ARIA serializes to `"true"`/`"false"` in SSR (see `references/remix3-jsx-attribute-conventions/jsx-attributes.md`), so no string ternary is needed.
- Focus restoration: `focusItemTrigger(id)` inside `handle.queueTask` prefers `[data-item-menu-button]` only when `window.matchMedia('(hover: none)').matches` **and** it is rendered (`offsetParent !== null`), falls back to `[data-item-id]`, then the add field. Do not use `offsetParent` as a touch proxy: the kebab is also visible on pointer devices at <=900px (and in the 800×400 component browser test viewport), and focusing it there drops the row's arrow-key flow. Use `CSS.escape` in interpolated attribute selectors. Use the helper for Escape, move actions, and delete.
- Outside dismissal is a delegated document `pointerdown`; Escape lives in the same document `keydown`; both attach with `handle.signal`. Skip closing when the pointer target is inside `[data-item-menu]` or `[data-item-menu-button]`.
- `queueTask` only drains on an update. A client entry that mutates DOM attributes imperatively (the server sidebar menu) must call `void handle.update()` after queueing, or the task waits forever; entries with no render can use a timer instead (`references/remix3-client-entries/queuetask-over-raf.md`).
- Server-rendered sidebar rows reuse the inline menu: one always-visible 44px `[data-list-menu-button]` **after** the link (a separate tab stop; keep the link's roving tabindex) and a `[data-list-menu]` second line on a `flex-wrap` row, so the scrolling `<nav>` cannot clip it. Keep closed menus `display: none`, toggle a `data-list-menu-open` attribute in the entry, and mirror it in `aria-expanded` so closed actions leave the tab order. Entry: `app/actions/lists/public/lists-row-actions.tsx`; e2e: `app/actions/lists/lists-sidebar-menu.test.e2e.ts`.
- Sidebar wiring: one delegated `pointerdown` (outside), `keydown` (Escape), and a **capture-phase** `click` (action close) per wiring pass; abort the previous pass on `reloadComplete`. The capture phase is required when another entry (rename) calls `stopPropagation()` in its own document-capture handler.
- Set `draggable="false"` on the trigger, menu, and menu buttons, and guard the row `dragstart` with `target.closest('button, input, textarea, [contenteditable]')`.
- In a phone drawer, scope the "destination chosen" collapse to `a[href]`; collapsing on any click inside the sidebar hides the menu the trigger just opened.

## 7. Help sheet, mobile toolbar fold, double-click editing

- Keep the `?` live-region announcement and open a real modal: focus the close button on open through a `ref` guard (`if (el && !el.dataset.focusReady) ...`), close on Escape and overlay click, announce the close, then `handle.queueTask(() => trigger.focus())` followed by `void handle.update()`. When the trigger is hidden at phone width, fall back to `[data-lists-more] summary` (the phone menu action is the trigger there).
- Fold the mobile toolbar on `@media (max-width: 768px)`, not `(hover: none)`: `page.setViewportSize({ width: 390 })` does not flip hover media in desktop Chromium/Firefox, so a hover-keyed fold cannot be asserted at phone width. Keep folded menu actions >= 44px and assert `getComputedStyle(help).display` is `none` at 390 and not `none` at 1440.
- Double-click editing: the runtime event map has no `dblclick`; use the row's `on('click')` and native `event.detail === 2`. Guard nested controls with `target.closest('input, button, a, textarea, select')`, or double-clicking the checkbox/kebab toggles it and starts editing. Keep the pencil button and document both affordances in the help sheet.
- Put that handler on the row: a conditional `.filter(Boolean)` mix array on the label broke `on('click')` inference (see `references/remix3-frame-cliententry/cliententry-lifecycle.md` constraint 3 — use the spread conditional instead).
- Done/total badge: keep the text/title/`aria-label` and prepend an `aria-hidden` ring whose `conic-gradient` uses the theme success/border tokens at `done/total * 100%`. It removes the `0/35` ambiguity without a second visible label (`app/ui/lists-layout.tsx`).

## 8. Sidebar search, sort, page size, and result count

- Use **one GET form** for search + sort + size. The selects live inside the search form, so a normal submit serializes `filter`, `sort`, `size`, and the hidden `load`; `ListsSearch` adds a `change` listener that calls `form.requestSubmit()` (the existing debounced input path already does).
- Controller: `sort` in `recent|name|count`; `size` is a preset or any integer 5–100, `all` maps to the query cap (100); the default size stays the session value from `getPageSize`. `getListSummaries` takes `sort` and returns `total` from a COUNT with the same WHERE clause. Order aliases: `LOWER(COALESCE(NULLIF(title, ''), description, ''))` for name, `item_count DESC` for count.
- `appendSidebarParams(params)` appends filter/sort/size to list links and pagination links; `withSidebarState(href)` adds `offset` plus those three to POST actions. POST forms do not inherit the page query, so duplicate/delete redirect preservation needs the helper — controller tests that call the endpoint with a query mask this. Read current values from the frame URL (`currentFilter`/`currentSort`/`currentSize`), not from entry state.
- Result count: `{total} Listen` / `{total} Treffer`, with a `title` stating `N von total sichtbar` when paged.
- Any mutation (including bulk done/open) calls `disarmClear()` before touching items, so a previously armed two-step destructive action cannot fire on the new state.
- Empty state: `Keine Treffer` + reset when filtered; a 44px `+ Erste Liste erstellen` link to `/lists?new=1` only when unfiltered.

## Tests

- `app/actions/lists/public/lists-polish.test.browser.tsx` — help focus/Escape/overlay, document undo vs native input undo, chip cleared by the next mutation, double-click row vs nested control, two-step clear disarmed by a bulk action, manual save secondary.
- `app/actions/lists/public/lists-autosave.test.browser.tsx` — debounce/coalescing and the deferred-PUT undo race.
- `app/actions/lists/public/lists-view-controls.test.browser.tsx` — tabs/counts, filter composition, hide-done visible-step reorder, hidden-selection labeling, filtered-empty reset, view-only sort/reverse/shuffle.
- `app/actions/lists/public/lists-item-menu.test.browser.tsx` — outside pointerdown, Escape focus, move/delete focus, filtered move guard.
- `app/actions/lists/public/lists-bulk-actions.test.browser.tsx` — bulk done/open over hidden rows, picker loading/empty/error/arrow/Escape, single-row move route.
- `app/actions/lists/public/lists-row-actions.test.browser.tsx` + `app/actions/lists/lists-sidebar-menu.test.e2e.ts` — server sidebar menu open/close/focus/tab stop and 44px geometry.
- `app/actions/lists/lists-view-controls.test.e2e.ts` — status strip geometry, hide-done count, help fold at 390 vs 1440; `app/actions/lists/lists-row-toolbar.test.e2e.ts` — one toolbar/focus after reorder.
- `app/actions/lists/lists-compact-layout.test.e2e.ts` — geometry at 390/820/1440 (label/composer/status strip/header), cluster-vs-kebab visibility, page overflow, notification bell.
- `app/actions/lists/controller.test.ts` + `app/data/lists.test.ts` — sort/size/targets, atomic move (order, partial rejection, stale If-Match), merge.

## Related

- `references/remix3-client-entries/queuetask-over-raf.md` — why post-close focus is a task, and when a task needs a following update.
- `references/remix3-client-entries/roving-tabindex-keyboard-lists.md` — the row keyboard model these controls sit on.
- `references/remix3-frame-cliententry/cliententry-lifecycle.md` — mixin inference constraint and the serialized-prop boundary.
- `references/remix3-jsx-attribute-conventions/jsx-attributes.md` — boolean ARIA/`data-*` serialization.
- `references/remix3-css-and-layout/hover-reveal.md` — the hover/focus reveal the touch menu replaces.
- `references/remix3-testing/cliententry-browser-tests.md` — deferred-response and document-scoped entry tests.
- `remix3-server` § Security — `/api/*` skips CSRF, so session endpoints stay on the authenticated page route.
