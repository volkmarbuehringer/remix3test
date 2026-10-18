# Undo, keyboard help, and sidebar sort/page-size controls

**Extracted:** 2026-10-18
**Context:** Final /lists polish (`remix` 3.0.0 / `@remix-run/component` 1.0.0, build `7f900151`). The undo chip expired after 6s, `?` only announced text, the mobile toolbar stayed ~3 rows at 390px, editing required the pencil, and the sidebar had no sort/page-size/result-count or empty-state CTA.

## Problem

- **A timer is the wrong undo boundary.** The 6s chip disappeared while the action was still the obvious last thing the user did, and Ctrl/Cmd+Z did nothing outside inputs.
- **A text-only help control is not discoverable.** The existing `?` button announced the shortcuts into a live region but showed nothing; a visible sheet needs focus entry/return and Escape.
- **Touch-only CSS is untestable in a desktop Playwright context.** `@media (hover: none)` does not flip for `page.setViewportSize({width: 390})` in headless Chromium/Firefox, so a toolbar fold keyed on hover cannot be asserted at phone width in the existing e2e.
- **`on('dblclick')` is not in the runtime's event map.** The type rejects it, and `.filter(Boolean)` around a conditional mix obscures the error (see `cliententry-lifecycle.md` §3).
- **Sidebar search/sort/page-size state must survive navigation.** Build links from `URLSearchParams` once and append the same state to list rows, pagination, search and copy/destroy redirects.
- **The done/total badge is ambiguous.** `0/35` alone does not say whether 0 is done or remaining.

## Solution

### Last-action undo + Ctrl/Cmd+Z

Drop the timer and clear the snapshot on the next mutation:

```ts
let showUndo = (kind, snapshot) => {
  undoSnapshot = snapshot
  undoKind = kind
  keepUndoForMutation = true // consumed by the immediately following setDirty
  void handle.update()
}

let setDirty = () => {
  if (keepUndoForMutation) keepUndoForMutation = false
  else if (undoSnapshot !== null) clearUndo()
  // ... draft/status/scheduleAutosave
}
```

Every destructive path calls `showUndo(...)` **immediately before** its `setDirty()`; any other mutation (typing the title, toggling done, adding, editing, moving) clears the chip. Do not clear on autosave. Bind the shortcut on `document` and leave native text undo alone:

```ts
if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
if (event.key.toLowerCase() !== 'z') return
if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
if (undoSnapshot === null) return
event.preventDefault()
undo()
```

Document the policy in the chip title and the help sheet; do not add redo.

### Focus-managed help sheet

Keep the `?` trigger's live-region announcement, add a modal with the shortcut list, and:

- focus the close button on open via a `ref` guard (`if (el && !el.dataset.focusReady) ...`);
- Escape and overlay click close; `announce('Tastatur-Hilfe geschlossen')`;
- `handle.queueTask(() => trigger.focus())` **then** `void handle.update()`;
- fall back to the toolbar `[data-lists-more] summary` when the trigger is hidden (the phone menu action is the trigger there).

### Deterministic mobile toolbar fold

Use `@media (max-width: 768px)` for "fold into the … menu", not `hover: none`, so the 390px e2e exercises the same branch a phone gets. Base desktop stays unchanged:

```ts
export const touchOnlyToolbarActionStyle = css({
  display: 'inline-flex',
  '@media (max-width: 768px)': { display: 'none' },
})
export const touchOnlyMenuActionStyle = css({
  display: 'none',
  width: '100%',
  minHeight: '44px',
  '@media (max-width: 768px)': { display: 'flex' },
})
```

Keep the folded menu actions >=44px and assert `getComputedStyle(help).display === 'none'` at 390 plus `!== 'none'` at 1440.

### Double-click editing

The runtime event map has no `dblclick`. Use the row's existing `on('click')` and the native `event.detail === 2`:

```ts
on('click', (event) => {
  view.setFocusedId(item.id)
  if (event.detail === 2) startEditing(realIndex)
})
```

Keep the pencil button; document both in the help sheet. The trigger moved from the label span to the row because a conditional `.filter(Boolean)` mix array broke `on('click')` inference on the span.

### Sidebar sort/page-size/result count

Use **one GET form** for search + sort + size. The selects live inside the search form, so a normal submit serializes `filter`, `sort`, `size` and the hidden `load` id; `ListsSearch` adds a `change` listener that calls `form.requestSubmit()` (the existing debounced input path already does this).

- Controller: `sort` in `recent|name|count`, `size` in presets or any integer 5–100, `all` → the query cap (100). Default size stays the session value from `getPageSize`.
- Data: `getListSummaries` takes `sort` and returns `total` from a COUNT query with the same WHERE clause. Order aliases: `LOWER(COALESCE(NULLIF(title,''), description, ''))` for name, `item_count DESC` for count.
- Layout: one `appendSidebarParams(params)` helper appends filter/sort/size to list links and pagination links; the controller's return/copy redirects do the same. Read the current values from the frame URL.
- Result count: `{total} Listen` / `{total} Treffer`, with a `title` stating `N von total sichtbar` when paged.
- Empty state: keep "Keine Treffer" for a filter, and add a 44px "+ Erste Liste erstellen" link to `/lists?new=1` only when unfiltered.

### Done/total count ring

Keep the badge's text/title/aria-label and prepend an `aria-hidden` 14px ring whose background is a `conic-gradient` of the theme success/border tokens at `done/total * 100%`. It clarifies `0/35` without a second visible label.

## Verify

- Browser: help focus/Escape/overlay; Ctrl/Cmd+Z outside an input restores the item, inside an input does nothing, and the chip clears on the next mutation; double-click opens the editor; delete uses the trash glyph; manual save is secondary and disabled when clean; reverse's pressed class differs; the hidden-selection select-all label says "Sichtbare abwählen".
- Server: `?filter=` matches item labels and reports `1 Treffer`; `?sort=name&size=all` orders Alpha before Zulu; pagination links carry filter + sort + size.
- E2E: at 1440 the `?` is visible; at 390 it is `display: none` and the opened menu's reverse action is >=44px; changing sort/size navigates with the values and keeps the active list; no horizontal overflow.
- Sidebar search/sort/size is one form, so a frame reload preserves all three.

## Related

- `bulk-actions-and-target-picker.md` — hidden selections, the undo snapshot shape, and the target picker focus pattern.
- `view-only-list-controls.md` — sort/reverse are view-only; the sidebar sort is a query, not persisted list order.
- `touch-row-action-menu.md` — focus restoration and 44px touch targets.
- `cliententry-lifecycle.md` §6 — `indeterminate` is a DOM property; SSR emits no attribute.
