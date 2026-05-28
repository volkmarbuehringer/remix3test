## 1. Utility Module

- [x] 1.1 Create `app/utils/grid-state.ts` with `GridState` interface, `gridStateFromURL()`, `gridStateFromForm()`, `gridStateToParams()`, and `editingRedirect()` helpers
- [x] 1.2 Create `app/ui/grid-state-hidden.tsx` with `<GridStateHiddenInputs>` component rendering the 4 hidden `<input>` fields

## 2. Controller Refactoring

- [x] 2.1 Refactor `index` and `grid` actions to use `gridStateFromURL()`
- [x] 2.2 Refactor `create`, `update`, and `destroy` actions to use `gridStateFromForm()` + `editingRedirect()`
- [x] 2.3 Refactor `edit` action to use `gridStateFromURL()` + `editingRedirect()`

## 3. UI Component Refactoring

- [x] 3.1 Replace hidden input blocks in `edit-page.tsx` and `create-page.tsx` with `<GridStateHiddenInputs>`
- [x] 3.2 Replace hidden input block in `client-del-button.tsx` with `<GridStateHiddenInputs>`

## 4. Verification

- [x] 4.1 Run `pnpm run typecheck` to verify type correctness
- [x] 4.2 Run `pnpm test` to verify no test regressions
