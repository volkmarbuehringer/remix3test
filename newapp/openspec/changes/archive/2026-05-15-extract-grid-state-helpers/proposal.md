## Why

The client lab controller (`app/actions/client/controller.tsx`) has ~69 lines of duplicated pagination state propagation logic spread across 6 action handlers. The same 4-field pattern (`offset`, `sort`, `order`, `filter`) is read from URLs, written into hidden form inputs, read back from form data, and rebuilt into redirect URLs — repeated in slightly different forms across every CRUD action and 3 UI components. This makes the controller hard to read at 312 lines, makes changes error-prone (you have to update 6 spots), and the pattern is impossible to reuse if more grid pages are added elsewhere.

## What Changes

- Create `app/utils/grid-state.ts` with shared utility functions for grid state parsing and redirect building
- Create `app/ui/grid-state-hidden.tsx` with a shared hidden-inputs component
- Refactor `app/actions/client/controller.tsx` to use the new utilities — cutting each mutation handler from ~30 lines to ~10
- Refactor `app/actions/client/edit-page.tsx`, `app/actions/client/create-page.tsx`, and `app/assets/client-del-button.tsx` to use `<GridStateHiddenInputs />`
- No breaking changes — all route names, URL patterns, and behavior remain identical

## Capabilities

### New Capabilities

No new capabilities — this is a pure refactoring with zero behavioral change.

### Modified Capabilities

None. No spec-level requirements are changing.

## Impact

- **New files**: `app/utils/grid-state.ts`, `app/ui/grid-state-hidden.tsx`
- **Modified files**: `app/actions/client/controller.tsx`, `app/actions/client/edit-page.tsx`, `app/actions/client/create-page.tsx`, `app/assets/client-del-button.tsx`
- **No API changes**: All route patterns, URL shapes, redirect targets, and form field names remain identical
- **No test changes**: The client controller tests (controller.test.ts) should continue to pass without modification
