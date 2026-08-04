## 1. Editor item-list keyboard model

- [x] 1.1 Add `focusedId` and `grabbedId` state to the `ListsClient` `clientEntry` closure (alongside existing drag state).
- [x] 1.2 Refactor `moveUp`/`moveDown` into a shared `moveItem(from, to)` used by both buttons and keyboard gestures; preserve `setDirty()` + `scheduleAutosave()` behavior.
- [x] 1.3 Render each item row with roving `tabindex` (`focusedId` ? 0 : -1) and `role="listitem"` inside a `role="list"` container; add `data-item-id`.
- [x] 1.4 Implement `keydown` handler on rows: `ArrowUp`/`ArrowDown` (focus move, clamp), `Home`/`End`, printable typeahead.
- [x] 1.5 Implement grab model: `Enter`/`Space` toggles `grabbedId`; arrows move via `moveItem` with focus-follow; `Enter`/`Space` drops; `Esc` cancels.
- [x] 1.6 Implement quick-move: `Ctrl+ArrowUp` / `Ctrl+ArrowDown` moves focused item directly.
- [x] 1.7 Add `focusItem(id)` helper that focuses the row element after `handle.update()` so focus tracks the item by id.

## 2. Announcement + hint

- [x] 2.1 Add visually-hidden `aria-live="polite"` region; announce grab / move / drop / cancel with position "X von N".
- [x] 2.2 Add visible muted hint line under the control bar documenting the keys (DE locale strings).

## 3. Sidebar keyboard navigation

- [x] 3.1 Give sidebar list rows roving `tabindex` + `role="listitem"`; track sidebar `focusedListId`.
- [x] 3.2 Add `keydown`: `ArrowUp`/`ArrowDown`/`Home`/`End` + typeahead; `Enter`/`Space` activates (navigates) the focused row.
- [x] 3.3 Confirm list *reordering* itself stays out of scope (no backend ordering endpoint).

## 4. Tests

- [x] 4.1 Add keyboard-simulation test: grab → move → drop asserts new order + dirty status.
- [x] 4.2 Add test: `Ctrl+ArrowUp` moves focused item up; `Esc` cancels grab with no change.
- [x] 4.3 Add test: typeahead jumps focus to matching row.
- [x] 4.4 Add sidebar test: arrow navigation moves focus; `Enter` activates and frame navigates.

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and `npm test`.
- [x] 5.2 Run `npx openspec validate lists-keyboard-accessibility`.
