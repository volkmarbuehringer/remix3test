## Context

All seven admin `clientEntry` components that attach DOM event listeners use a `let mounted = false` guard in the factory closure to prevent duplicate listener registration on `handle.update()`. This pattern breaks under Remix 3 Frame navigation because:

1. Frame-targeted navigation (sort, paginate, filter) replaces the Frame's DOM content
2. The clientEntry's factory closure is preserved across Frame updates (only the render function re-runs)
3. `mounted` remains `true`, so the listener attachment logic is skipped
4. The new DOM nodes have no event listeners → context menu silently stops working

The pattern exists in 7 files:
- `app/assets/nutzer-table-interactive.tsx` — different structure (uses `getElementById` in render)
- `app/assets/admin-resources-context-menu.tsx` — uses `ref()` with `mounted` guard
- `app/assets/admin-offering-configs-context-menu.tsx` — same ref pattern
- `app/assets/admin-users-context-menu.tsx` — same ref pattern
- `app/assets/admin-offerings-context-menu.tsx` — same ref pattern
- `app/assets/admin-appointments-context-menu.tsx` — same ref pattern
- `app/assets/client-grid-inline-edit.tsx` — uses `mounted` in render, different from ref pattern

## Goals / Non-Goals

**Goals:**
- Context menus work after Frame navigation (sort, paginate, filter)
- Inline grid edit survives Frame reload
- No duplicate listener accumulation on `handle.update()` (current `mounted` behavior preserved)
- Proper listener cleanup when DOM is removed (Frame replacement or component disposal)
- Minimal diff — preserve existing action handlers, menu structure, and UX

**Non-Goals:**
- Changing menu content, structure, or UX
- Refactoring server-side controller logic
- Adding new capabilities or actions
- Fixing unrelated clientEntry patterns that don't use `mounted`

## Decisions

### Decision 1: Standardize on `ref()` with per-insertion signal cleanup

**Choice:** Use the `ref()` mixin's AbortSignal for listener lifecycle, removing the `let mounted = false` guard.

**Rationale:**

The `ref(callback)` mixin calls the callback when the element is inserted and provides an `AbortSignal` that fires when the element is removed. This gives us:

```
Frame sor t navigation flow:
┌─────────────────────────────────────────────────────┐
│                                                      │
│  Old trigger div removed from DOM                    │
│    → ref's AbortSignal fires                         │
│    → old contextmenu listener cleaned up             │
│    → (old table may also be gone — no leak)          │
│                                                      │
│  New Frame content inserted                          │
│    → clientEntry render function re-runs             │
│    → new trigger div inserted into DOM               │
│    → ref() fires again (new insertion)               │
│    → contextmenu listener attached to fresh table    │
│                                                      │
│  Right-click → works correctly on new content        │
└─────────────────────────────────────────────────────┘
```

Alternatives considered:

| Alternative | Problem |
|---|---|
| Cache table reference + AbortController in render | Works but is `nutzer`-only, doesn't fix ref-based files |
| MutationObserver on Frame container | Over-engineered, indirect |
| Re-create clientEntry on Frame update | Would require Remix runtime changes |
| Remove `mounted` without using ref's signal | Would accumulate duplicate listeners on `handle.update()` |

### Decision 2: Convert `nutzer-table-interactive.tsx` to ref-based pattern

**Choice:** Rewrite the direct `document.getElementById` approach to use the same `ref()` pattern as the other context menus.

**Rationale:** Having two different patterns for the same purpose is maintenance debt. The ref pattern is more idiomatic (element lifecycle managed by the framework) and the fix is the same: remove the `mounted` guard.

The conversion moves:
- Event listener attachment from `attachContextMenuListeners(tableData, ...)` → into `ref()` callback on the trigger div
- Data reading from closure-captured `tableData` → from `readData()` at event handler time (fresher)
- `handle.update()` callback → directly in the event handler before trigger dispatch

### Decision 3: Fix client-grid-inline-edit.tsx with same approach

**Choice:** Apply the table-identity tracking pattern (compare cached table ref on each render) rather than converting to ref.

**Rationale:** This file doesn't have a trigger div to attach `ref()` to — it returns `<div style="display:none">`. The minimalist fix is to track the table element identity and use `handle.signal` + a per-attachment `AbortController` to manage cleaning previous listeners. This avoids a larger refactor of unrelated inline-edit logic.

### Decision 4: Fix all 7 files in one change

**Choice:** Include all context menus and the inline edit in a single change rather than filing separate bugs.

**Rationale:** Same root cause, same fix pattern, minimal risk per file. Splitting would create coordination overhead for no benefit.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `ref()` not firing on re-insertion after Frame update | Remix docs confirm `ref()` fires "when an element is inserted." Frame replacement removes+re-inserts the trigger div. |
| Duplicate listener on rapid handle.update() + Frame navigation | `ref()`'s AbortSignal fires on removal (not on handle.update()), so listener persists across renders and is only rebuilt on actual DOM insertion |
| Nutzer conversion introduces regression | Existing right-click → menu → action flow is unaffected; the event handler logic is identical, just moved inside the `ref()` callback |
| `client-grid-inline-edit` AbortController management | The AbortController is local to the factory closure, cleaned up by `handle.signal` on component disposal |
