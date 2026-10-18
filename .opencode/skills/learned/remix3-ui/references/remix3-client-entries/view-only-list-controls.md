# View-only list filters, status tabs, and ordering

**Extracted:** 2026-10-18
**Context:** The /lists editor (`remix` 3.0.0 / `@remix-run/component` 1.0.0, build `7f900151`). The old A–Z/due/updated control mutated `items`, autosaved, and relied on a 6s undo; reverse/shuffle did the same. A view-only state removes the irreversible reorder entirely.

## Problem

- A one-shot sort rewrote the persisted manual order and autosaved it; once the undo chip expired, the order was unrecoverable.
- Filtered reorder ambiguity was guarded only for the text search. Status filters, hide-done, and a view-only sort have the same problem: moving relative to a hidden row changes the saved order without changing the visible one.
- Status counts, hide-done, and the text filter must compose, and a selection can outlive the rows it points at.

## Solution

- Keep the view state in the client closure: `statusFilter`, `hideDone`, `sortMode`, `reverseView`, `shuffleOrder`. None of these call `setDirty()` or `showUndo()`; the persisted array is only changed by drag/keyboard/move.
- One pure pipeline: `buildVisibleItems(items, { query, status, hideDone, sort, reverse, shuffleOrder })` = `filterItems` → `filterItemsByStatus` → `orderViewItems`. `manual` returns a copy, and every transform is applied to that copy.
- `reorderLocked() = textFilter || status !== 'all' || hideDone || viewOrderActive()`. Use it for the drag start, keyboard grab/quick-move, `moveItem`, and `rowDraggable` (which hides up/down in the row menu). The old drag-context field `isFilterActive` becomes `isReorderLocked` — its only job was gating position-based reorder.
- Status counts follow the text/tag filter but not the status filter: `countItemsByStatus(filterItems(items, query))`. Overdue means open + due before today (done never counts); the `Alle` count switches to the open count while hide-done is active so the tab badge matches the rows it shows.
- Hide-done is independent of the tabs. Selecting `Erledigt` clears and disables it, so the explicit done tab can never be silently emptied.
- Selection persists across filters. Render `N ausgewählt (inkl. X verborgener)` when `selectedExisting - visibleSelected > 0`, and label bulk delete/copy as including hidden rows. Use the full `items` for the progress counter, not the filtered view.
- The filtered empty state renders `Filter zurücksetzen`, which clears text + status + hide-done (not the sort).
- The sort `<select>` is uncontrolled: sync its DOM value from `sortMode` in the change handler and on load. A visible `Ansicht` badge plus a `title` says the order is not persisted (the same controlled-reflection trap as the metadata selects).
- Clear every view control in `resetViewState()` on hydrate and frame navigation, so a status/sort cannot leak into the next list.

## Verify

- Unit: status counts/filtering, `buildVisibleItems` leaves the input array untouched, shuffle keeps unknown ids at the end.
- Browser: tabs/counts, text+status+hide-done composition, hidden-selection label, empty-state reset, A–Z/reverse/shuffle leave the list `Gespeichert` with no undo chip.
- E2E: after A–Z and the autosave debounce, the DB order is still the original; the status strip is overflow-free at 390x844 and 1440x900 with 44px targets.

## Related

- `remix3-ui` § Client Entries → `touch-row-action-menu.md` — the reorder guard and focus-restoration pattern this extends.
- `remix3-ui` § Client Entries → `queuetask-over-raf.md` — no render, no `queueTask`; the view controls are pure synchronous state.
