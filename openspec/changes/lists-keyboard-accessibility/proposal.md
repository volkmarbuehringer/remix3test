## Why

The Lists editor is currently mouse-only for reordering. Items can only be reordered by dragging the grip or by clicking the per-row ↑/↓ buttons — both require a mouse or heavy tabbing through every control. The sidebar list rows are likewise a Tab maze (every link plus a delete button). Keyboard and screen-reader users cannot reorder items or efficiently navigate between lists. This change closes that accessibility gap and brings the editor to parity with the drag-and-drop behavior it already ships.

## What Changes

- The editor item list becomes a keyboard-navigable list via a **roving tabindex**: exactly one row is in the tab order at a time; `ArrowUp`/`ArrowDown` (and `Home`/`End`) move focus, and printable-character typeahead jumps to the first row whose label starts with that character.
- Two reorder gestures are supported:
  1. **Grab model** — `Enter`/`Space` picks up the focused item; `ArrowUp`/`ArrowDown` move it; `Enter`/`Space` drops; `Esc` cancels. Mirrors the mental model of drag-and-drop.
  2. **Quick-move** — `Ctrl+ArrowUp` / `Ctrl+ArrowDown` moves the focused item directly, with no grab state.
- Focus **follows the item id** across reorders (rows are already `key={item.id}`), so the caret stays on the same item after a move rather than snapping to an index.
- A visually-hidden `aria-live="polite"` region announces grab / move / drop and the item's new position; a small visible hint line under the control bar documents the keys.
- The sidebar list rows receive the same roving-tabindex + arrow / typeahead navigation, with `Enter`/`Space` activating the row (matching the existing click-to-navigate behavior). Reordering the sidebar list *order* itself stays out of scope — there is no backend ordering for lists, and the existing cross-list **item** move is a drag gesture initiated from the editor, not from the sidebar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lists-editing`: adds the new "Keyboard navigation and reordering" requirement.

## Impact

- `app/actions/lists/lists-client.browser.tsx`: add roving-tabindex + `keydown` handling, focus-follow state, grab / quick-move logic reusing the existing `moveUp`/`moveDown` helpers (refactored to a shared `moveItem(from, to)`), the `aria-live` region, and the visible hint line.
- `app/ui/lists-layout.tsx`: add roving-tabindex + `keydown` navigation to sidebar list rows, with `Enter`/`Space` activation.
- `app/actions/lists/controller.test.ts`: add keyboard-simulation tests (focus → grab → move → drop → assert new order and dirty state; sidebar focus + activation).

No new routes, endpoints, or backend changes.
