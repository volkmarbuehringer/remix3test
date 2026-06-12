## 1. Type event handlers

- [x] 1.1 Remove explicit `any` from `on('keydown')` callbacks in `app/ui/appointment-grid.tsx` (inferred type)
- [x] 1.2 Remove explicit `any` from `on('pointerdown')` callbacks in `app/ui/appointment-grid.tsx` (inferred type)
- [x] 1.3 Remove explicit `any` from `on('keydown')` callbacks in `app/ui/appointtype-panel.tsx` (inferred type)

## 2. Add error logging to bare catch blocks

- [x] 2.1 Add `context.get(Logger)` calls to bare `catch {}` blocks in `app/actions/lists/controller.tsx`

## 3. Verify

- [x] 3.1 Run `npm run typecheck`
- [x] 3.2 Run `npm test`
