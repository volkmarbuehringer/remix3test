## Why not the toolkit `listbox`?

`remix/ui` exports a `listbox`, but it is a **single-select / typeahead** widget: `ListboxProvider` registers `option` values and emits `onSelect`. It is built for *picking one value*, not for reordering rich rows that already contain a checkbox, a grip, and edit/delete/move buttons. ARIA also forbids interactive descendants inside `role="option"`. Dropping the toolkit `listbox` in would force a refactor of every row. The hand-rolled **roving-tabindex + grab/drop** pattern keeps the existing controls intact and reuses the current `moveUp`/`moveDown` logic.

## Roving tabindex model

```
container (role="list", aria-orientation="vertical")
  row  tabindex=0   ← only the row whose id === focusedId
  row  tabindex=-1
  row  tabindex=-1
```

- One row is tabbable; arrow keys move `focusedId` and focus that row's element.
- Inside a focused row, `Tab` still reaches `[done] [edit] [↑] [↓] [delete]` (nested tab order preserved).

## Key bindings (editor item list)

| Key(s) | Behavior |
|---|---|
| `ArrowDown` / `ArrowUp` | Move focus to next / prev row (clamp at ends) |
| `Home` / `End` | Jump to first / last row |
| `Enter` / `Space` (not grabbed) | Grab the focused item |
| `ArrowDown` / `ArrowUp` (grabbed) | Move item via `moveItem`, keep `grabbedId` + `focusedId` on same id |
| `Enter` / `Space` (grabbed) | Drop |
| `Esc` (grabbed) | Cancel grab (no reorder) |
| `Ctrl+ArrowUp` / `Ctrl+ArrowDown` | Quick-move focused item, no grab state |
| printable char | Typeahead: jump to first row whose label starts with that char |

## Focus management

- Track `focusedId: string | null` and `grabbedId: string | null` in the `clientEntry` closure (sibling to the existing drag state).
- After any reorder, call a `focusItem(id)` helper that runs after `handle.update()` and sets `.focus()` on the row element with that `data-item-id`. Because rows are keyed by `item.id`, the DOM node persists across reorders and focus sticks to the same item.
- `moveUp`/`moveDown` are collapsed into `moveItem(from, to)`; both the existing buttons and the new keyboard gestures call it, then `setDirty()` + `scheduleAutosave()` exactly as today.

## Announcements

- Add a visually-hidden `<div aria-live="polite">` next to the control bar. On grab: "Element aufgenommen, Position X von N". On move: "Position Y von N". On drop: "Abgelegt an Position Y von N". On cancel: "Verschieben abgebrochen".
- Add a visible hint line (muted, `theme.fontSize.xs`): "Tipp: Enter zum Aufnehmen, Pfeile zum Verschieben, Enter zum Ablegen. Strg+Pfeile für Direktverschieben."

## Sidebar (scope B)

- Sidebar list rows get the same roving tabindex + `ArrowUp`/`ArrowDown`/`Home`/`End` + typeahead navigation.
- `Enter` / `Space` activates the focused row (navigates to that list), equivalent to the existing click.
- List *order* reordering is explicitly **out of scope** — the backend returns lists in a fixed order and exposes no reorder endpoint; matching the existing drag capability (which only moves *items* between lists, not the lists themselves) keeps scope honest.

## Test plan

- Keyboard simulation in `app/actions/lists/controller.test.ts`:
  - Focus first row → `Space` grab → `ArrowDown` → `Space` drop → assert items array reflects swap and status is dirty.
  - `Ctrl+ArrowUp` on last row → assert it moved up one position.
  - `Esc` during grab → assert order unchanged.
  - Typeahead char jumps focus to matching row.
  - Sidebar: `ArrowDown` moves focus across rows; `Enter` activates and frame navigates.
