# Touch row action menus: kebab + inline menu

**Extracted:** 2026-10-18
**Context:** Dense `/lists` element rows in this app (`remix` 3.0.0 / `@remix-run/component` 1.0.0, build `7f900151`). The hover-reveal action cluster was made always visible on touch; that kept actions reachable but collapsed the label. The replacement is one 44px kebab plus an inline second-line menu.

## Problem

- **The touch fallback squeezes the content.** The four hover buttons take ~120px. With `@media (hover: none) { opacity: 1; pointer-events: auto }`, the label measured **22px wide** at a 390px viewport. Making the cluster a full-width second line fixed the label but doubled row height (**63px → 115px**).
- **An absolutely positioned row menu clips inside the element list.** The list scrolls (`overflow-y: auto`); a menu anchored inside a row is cut off near the top/bottom. An inline menu cannot be clipped.
- **Filtered reorder is a silent no-op.** With an active in-list filter, moving a visible item up/down can swap it with a hidden neighbour. The visible order stays the same while the persisted order changes. The desktop cluster hid up/down while filtered; the new menu initially did not.
- **Focus is lost after an action.** Opening the menu focuses its first button. Choosing an action unmounts that button, so focus falls to `document.body`. The trigger is `display: none` on pointer devices, so focusing it directly is a no-op.

## Solution

### Layout

- On touch, **hide the view-mode hover cluster** with `display: none` (not `opacity: 0`) so it leaves layout and the tab order.
- Show one **44px kebab** per row. Base `display: none`; `@media (hover: none) { display: inline-flex }`.
- Let the row wrap (`flexWrap: 'wrap'`) and render the menu as an **inline second flex line**: `flexBasis: '100%'`, `display: grid`, `gridTemplateColumns: '1fr 1fr'`, 44px actions.
- Keep a separate edit-mode cluster for save/cancel. On touch it is `position: static; width: 100%`; make the editor `flexBasis: 100%` so the textarea and metadata fields get the full row width.

```ts
itemActionsStyle: { '@media (hover: none)': { display: 'none' } }
itemMenuButtonStyle: {
  display: 'none',
  '@media (hover: none)': { display: 'inline-flex', width: '44px', height: '44px' },
}
itemMenuStyle: { flexBasis: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }
itemEditActionsStyle: { '@media (hover: none)': { position: 'static', width: '100%' } }
itemEditMainStyle: { '@media (hover: none)': { flexBasis: '100%' } }
```

Kebab: `aria-expanded={menuOpen}`, `aria-label` including the item label. Menu: `role="group"` with an `aria-label`; focus the first action when it opens.

Known result on the 35-item fixture at 390px: row height stays **63px**, label width goes from **22px** to **~92px** (two clamped lines), and the page has no horizontal overflow.

### Reorder guard

The menu must mirror the view invariant, not just look disabled:

```ts
let moveItem = (from: number, to: number) => {
  // A filtered subset makes "up/down" ambiguous: moving against a hidden
  // neighbour can leave the visible order unchanged while saving a new order.
  if (filterActive()) return
  // ...
}
```

Also hide the menu’s `Nach oben` / `Nach unten` entries when the row is not draggable (`rowDraggable = !filterActive()`), matching the desktop cluster. For delete, compute the next/previous **visible** id before removing the row so focus lands on a surviving neighbour.

### Focus restoration

Use `handle.queueTask` after the closing update, with a fallback because the kebab is display-none on pointer devices:

```ts
let focusItemTrigger = (id: string | null) => {
  handle.queueTask(() => {
    if (id) {
      let trigger = document.querySelector<HTMLElement>(
        `[data-item-menu-button="${CSS.escape(id)}"]`,
      )
      if (trigger && trigger.offsetParent !== null) return trigger.focus()

      let row = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)
      if (row) return row.focus()
    }
    newItemRef?.focus()
  })
}
```

Use it for Escape, move actions, and delete. Outside dismissal is delegated on `document` with `pointerdown`; Escape lives in the same document `keydown` handler; both attach with `handle.signal`. Skip closing when the pointer target is inside `[data-item-menu]` or `[data-item-menu-button]`.

`CSS.escape` matters because item ids are interpolated into attribute selectors. The pre-existing `focusItem` uses the same selector pattern; this helper avoids adding another unescaped case.

### Server-rendered sidebar variant

The `/lists` sidebar rows are rendered by the server (not by `ListsClient` state), so the same inline menu is static markup plus a small client-entry controller:

- Render one always-visible 44px `[data-list-menu-button]` + `[data-list-menu]` group per row. Keep the row link's roving tabindex; the trigger is a separate, visible tab stop.
- Put the trigger *after* the link (not over it) and give the row `flex-wrap: wrap` so the menu is a `flex-basis: 100%` second line. The name and count badge stay visible while closed, and the scrolling `<nav>` cannot clip the menu.
- Keep closed menus `display: none` (not `opacity: 0`), toggle a `data-list-menu-open` attribute in the client entry, and mirror it in `aria-expanded`. Closed actions are then out of the tab order and unfocusable.
- Attach one delegated document `pointerdown` (outside dismissal), `keydown` (Escape), and capture-phase `click` (action close) per wiring pass; abort the previous pass on `reloadComplete`. The capture phase is required when another entry (rename) calls `stopPropagation()` in its own document-capture handler.
- Set `draggable="false"` on the trigger, menu, and menu buttons, and add `target.closest('button, input, textarea, [contenteditable]')` guards to the row `dragstart` handler.
- **`queueTask` only drains on an update.** A client entry that mutates DOM attributes imperatively has no render of its own, so a bare `handle.queueTask(focus)` stays in the component's task queue forever. Call `void handle.update()` after queueing (as done for the post-action focus fallback), or use a timer when the entry has no render to schedule.
- If the same sidebar sits in a phone drawer, scope the drawer's "destination chosen" collapse to `a[href]`. Collapsing on any click inside the sidebar hides the menu the trigger just opened.

### Browser tests

`app/actions/lists/public/lists-item-menu.test.browser.tsx` renders `ListsClient` with `initialState`, stubs `fetch`, and uses `result.act`:

- outside `pointerdown` closes the menu
- Escape closes it and focuses the row (desktop) / kebab (touch)
- `Nach unten` keeps focus on the moved item
- `Löschen` focuses the next surviving row
- a filtered menu contains only `Bearbeiten` / `Löschen`

Wait ~350ms after move/delete so the fast autosave hits the stub, then assert focus survived the server-echo re-render.

## Verify

- 390px: row 63px, label no longer 22px, no horizontal overflow.
- Filtered list: menu has no move actions, and `moveItem` returns without reordering (defense in depth).
- `document.activeElement` is the kebab on touch and the row on pointer devices after Escape/action; delete focuses the next/previous visible row.
- Current suite result: **126 lists browser tests pass** (including the sidebar menu open/close/focus/tab-stop suite); `app/actions/lists/lists-sidebar-menu.test.e2e.ts` checks the real SSR markup and 44px geometry at 390x844 and 1440x900 in Chromium and Firefox. Typecheck, format, lint, theme conformance, and the full `npm test` are green.

## When to Use

- A dense touch list has per-row actions and the hover cluster overlays or squeezes the label.
- A row menu is clipped by a scrolling list container.
- A filtered view exposes position-based reorder actions.
- A transient row menu loses focus after an action, or its trigger is hidden on pointer devices.

## Related

- `remix3-styling` § CSS & Layout → `references/remix3-css-and-layout/hover-reveal.md` — the hover/focus reveal mechanics this pattern replaces on touch.
- `remix3-ui` § Client Entries → `references/remix3-client-entries/queuetask-over-raf.md` — why the post-close focus is queued, not scheduled with `requestAnimationFrame`.
- `remix3-tooling` § Testing — the browser-test harness and fetch-stub patterns.