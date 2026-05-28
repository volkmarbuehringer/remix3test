## Why

Two context menus (`appointtype-panel.tsx` and `nutzer-table-interactive.tsx`) use a fragile hidden-trigger workaround: a `display:none` element repositioned at mouse coordinates, a synthetic `contextmenu` dispatch, and a `setTimeout` to re-hide it after 100ms. This causes race conditions (menu opens before trigger hides, or trigger hides before menu opens) and doesn't scale. The admin appointments context menu recently demonstrated the correct pattern: `opacity:0` for the hidden trigger with no `setTimeout` needed. This change brings both existing menus in line with that robust pattern.

## What Changes

### appointtype-panel.tsx (structural rewrite)
- Move `<menu.Context>` wrapper to enclose the type item list
- Replace hidden trigger + `handleContextMenu()` with direct `menu.contextTrigger()` on each type item
- Remove `setTimeout`-based display toggling and the `handleContextMenu()` function

### nutzer-table-interactive.tsx (targeted fix)
- Replace `display:none` trigger style with `opacity:0;pointer-events:none`
- Remove both `setTimeout`s (the nested `setTimeout(0)` for mount and the `setTimeout(..., 100)` for re-hiding)
- Use a `mounted` guard instead of `dataset.nutzerMenu` for one-time listener attachment

No behavior changes: right-click on either page still opens the same menu with the same actions.

## Capabilities

### New Capabilities
<!-- None — this is a code quality fix with no new capabilities -->

### Modified Capabilities
- `appointtypes-crud`: Context menu implementation pattern improved. No spec-level behavior change.
- `nutzer-crud`: Context menu implementation pattern improved. No spec-level behavior change.

## Impact

- **File modified**: `app/ui/appointtype-panel.tsx` — restructure context menu to use `menu.contextTrigger()` directly on items
- **File modified**: `app/assets/nutzer-table-interactive.tsx` — clean up hidden trigger to use `opacity:0`, remove setTimeouts, add mounted guard
- **No new dependencies** — `remix/ui/menu` already imported in both files
- **No API changes** — all existing actions remain identical
