## Why

Two small code quality issues spotted during a codebase scan: event handlers typed as `any` instead of their proper DOM types, and bare `catch {}` blocks that silently swallow errors.

## What Changes

- Type `on('keydown')` callbacks in `appointment-grid.tsx` from `any` to `KeyboardEvent`
- Type `on('pointerdown')` callbacks in `appointment-grid.tsx` from `any` to `PointerEvent`
- Type `on('keydown')` callbacks in `appointtype-panel.tsx` from `any` to `KeyboardEvent`
- Add error logging via `context.logger` (from `remix/middleware/logger`) to bare `catch {}` blocks in `lists/controller.tsx`

## Capabilities

### New Capabilities
- `typed-event-handlers`: Replace `any` with specific DOM event types in Remix 3 event mixins
- `catch-error-logging`: Add error logging via remix logger to bare catch blocks

### Modified Capabilities
*(none)*

## Impact

- `app/ui/appointment-grid.tsx`: ~6 event handler type changes
- `app/ui/appointtype-panel.tsx`: ~2 event handler type changes
- `app/actions/lists/controller.tsx`: ~3 catch blocks get `context.logger` calls
