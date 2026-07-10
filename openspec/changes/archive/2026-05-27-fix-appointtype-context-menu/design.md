## Context

Two context menus use the same fragile pattern:

### appointtype-panel.tsx

1. A hidden `<div>` with `menu.contextTrigger()` and `display:none` is placed below the type list
2. Each type item handles `contextmenu` via `on('contextmenu', ...)`, manually positions the hidden trigger, dispatches a synthetic event, then re-hides it with `setTimeout(..., 100)`
3. The `100ms` timeout is a race condition

### nutzer-table-interactive.tsx

1. Same hidden trigger with `display:none` and `setTimeout(..., 100)` race condition
2. Extra `setTimeout(() => { ... }, 0)` wrapping the listener attachment — a timing hack suggesting mount issues
3. Uses `dataset.nutzerMenu` flag to guard against duplicate listeners on re-render

The admin appointments context menu (`admin-appointments-context-menu.tsx`) recently demonstrated the robust pattern: `opacity:0;pointer-events:none` for the hidden trigger with no `setTimeout` needed. This change fixes both existing menus.

## Goals / Non-Goals

**Goals (appointtype-panel):**

- Move `<menu.Context>` to wrap the type item list
- Apply `menu.contextTrigger()` directly on each type item (canonical API)
- Remove `handleContextMenu()` and hidden trigger entirely

**Goals (nutzer-table-interactive):**

- Replace `display:none` toggling with `opacity:0;pointer-events:none`
- Remove both `setTimeout`s (mount wrapper and hide-trigger race condition)
- Replace `dataset.nutzerMenu` guard with a `mounted` guard

**Non-Goals:**

- No visual or behavioral changes to either context menu
- Not changing action handlers (Edit, Delete, Lock, Activate, etc.)
- Not changing the appointtype drag-and-drop logic

## Decisions

### Decision 1 (appointtype): Put `menu.contextTrigger()` directly on each type item

**Why**: Eliminates the hidden trigger, `setTimeout`, and synthetic event dispatch entirely. The mixin is designed for this use.

### Decision 2 (appointtype): Move `<menu.Context>` to wrap the type list

**Why**: `menu.contextTrigger()` requires a `menu.Context` ancestor. Currently the context is placed after the list. Moving it up wraps the items so the mixin can consume the provider.

### Decision 3 (appointtype): Use `on('contextmenu', ...)` alongside `menu.contextTrigger()` to store the right-clicked type

**Why**: `menu.contextTrigger()` calls `event.stopPropagation()` but this only prevents bubbling to ancestors, not other listeners on the same element. Both handlers fire: mixin opens the menu, our handler stores the type for `onMenuSelect`.

### Decision 4 (nutzer): Keep event delegation pattern, only fix the trigger toggling

**Why**: The nutzer code already uses event delegation (unlike appointtype which uses per-item handlers). The only problems are the `setTimeout` race condition and the `display:none` toggling. Changing to `opacity:0` eliminates both — no need to restructure.

### Decision 5 (nutzer): Replace `dataset.nutzerMenu` with a `mounted` guard in the clientEntry render cycle

**Why**: `dataset.nutzerMenu` mutates the DOM from within a render, which is fragile. A simple `let mounted = false` flag in the clientEntry closure is cleaner and avoids DOM mutation.

## Risks / Trade-offs

| Risk                                                                 | Mitigation                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `menu.contextTrigger()` on type items conflicts with drag events     | `handlePointerDown` checks `event.button !== 0` to ignore right-clicks; `contextmenu` fires after `pointerdown` so the drag path is already resolved                                       |
| Moving `<menu.Context>` in appointtype changes layout                | The `<menu.Context>` component renders no visible DOM — it's a React context provider. No layout impact.                                                                                   |
| Removing `setTimeout(0)` from nutzer could cause mount timing issues | The `mounted` guard in the render cycle runs after the DOM is committed, so `document.getElementById('nutzer-table')` will find the element. The original `setTimeout(0)` was unnecessary. |
