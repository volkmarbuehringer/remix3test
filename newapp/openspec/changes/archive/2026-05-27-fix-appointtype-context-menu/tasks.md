## 1. Fix appointtype-panel.tsx context menu

- [x] 1.1 Move `<menu.Context>` wrapper to enclose the type item list (currently it's below the list)
- [x] 1.2 Add `menu.contextTrigger()` mixin to each type item's `mix` array
- [x] 1.3 Add `on('contextmenu', () => { lastRightClickedType = t })` alongside `menu.contextTrigger()` to store the right-clicked type
- [x] 1.4 Remove the hidden trigger `<div>` with `menu.contextTrigger()` and `data-type-trigger` attribute
- [x] 1.5 Remove the `handleContextMenu()` function entirely
- [x] 1.6 Remove unused `currentRow` variable if no longer referenced

## 2. Fix nutzer-table-interactive.tsx context menu

- [x] 2.1 Replace hidden trigger `display:none` style with `position:fixed;width:0;height:0;opacity:0;pointer-events:none`
- [x] 2.2 Remove the `setTimeout(..., 100)` re-hide call in the contextmenu handler
- [x] 2.3 Remove the outer `setTimeout(() => { ... }, 0)` mount wrapper
- [x] 2.4 Replace `dataset.nutzerMenu` guard with a `mounted` flag in the clientEntry closure

## 3. Verify and typecheck

- [x] 3.1 Run typecheck: `pnpm run typecheck`
- [ ] 3.2 Verify appointtype right-click → Edit/Delete still works
- [ ] 3.3 Verify nutzer right-click → all actions still work (Edit, Reset PW, Lock/Unlock, Activate/Deactivate, Copy Email, Delete)
- [ ] 3.4 Verify appointtype drag-and-drop on type items still works (no regression from menu.Context shift)
