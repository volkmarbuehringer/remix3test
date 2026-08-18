---
name: roving-tabindex-keyboard-lists
description: "Keyboard-navigable lists: roving tabindex with bubbled-event guard, focus-by-id reorder, and safe listener re-init"
user-invocable: false
origin: auto-extracted
---

# Keyboard-Navigable Lists (Roving Tabindex)

**Extracted:** 2026-08-04
**Context:** Adding keyboard navigation + reordering to a rich item list that
already had mouse drag-and-drop, where rows contain nested interactive controls
(checkbox, edit textarea, action buttons).

## Problem

Making a list of rich rows keyboard-operable via roving tabindex surfaces three
non-obvious failure modes:

1. **Bubbled keydown events get hijacked.** A row-level keydown handler catches
   events from nested controls. Space on a checkbox toggles it *and* triggers the
   row's grab gesture; typing in an edit textarea hits the typeahead branch whose
   `preventDefault()` makes characters never insert; Enter on a button both
   activates it and starts a grab.
2. **Focus must follow the item, not the index.** After a reorder, the caret and
   the roving `tabindex` must track the moved item by its stable id, or focus
   lands on the wrong row.
3. **Re-init stacks duplicate listeners.** Re-running the wiring pass on every
   content reload without aborting the previous pass attaches a new handler per
   row per reload (unbounded growth).

## Solution

1. **Guard bubbled events at the top of the row handler:**
   ```ts
   let handleRowKeyDown = (e: KeyboardEvent, index: number) => {
     if (e.target !== e.currentTarget) return // nested controls keep their own semantics
     // ... arrows, Home/End, typeahead, grab/drop ...
   }
   ```

2. **Roving tabindex + focus-by-id.** Keep `focusedId`; render rows keyed by id;
   make exactly one row tabbable; after a move, focus the row via its id.
   Fall back to the first item when `focusedId` references a deleted row —
   otherwise every row gets `tabindex="-1"` and the list is unreachable:
   ```ts
   let activeItemId = () =>
     focusedId && items.some((i) => i.id === focusedId) ? focusedId : items[0]?.id ?? null
   // tabIndex={item.id === activeItemId() ? 0 : -1}
   ```
   After a reorder: `items = movedItems; focusedId = movedId; el.focus()` (DOM
   nodes are keyed by id, so the same element persists across reorder).

3. **Safe re-init.** Keep the previous pass's controllers and abort them first:
   ```ts
   let controllers: AbortController[] = []
   function wire() {
     for (let ac of controllers) ac.abort()
     controllers = []
     for (let row of rows) {
       let ac = new AbortController()
       controllers.push(ac)
       row.addEventListener('keydown', onRowKeydown, { signal: ac.signal })
     }
   }
   ```
   (Or use a single delegated listener on the container instead.)

4. **Typeahead:** exclude modifier keys (`!e.ctrlKey && !e.metaKey && !e.altKey`)
   so `Ctrl+C` etc. isn't swallowed; jump to the first label starting with the
   typed char, wrapping to the start.

## When to Use

- Building any keyboard-navigable list where rows contain buttons/inputs/checkboxes
- Adding a keyboard equivalent to a mouse drag-and-drop reorder
- Roving-tabindex lists that re-render on navigation and start accumulating
  duplicate keydown listeners
