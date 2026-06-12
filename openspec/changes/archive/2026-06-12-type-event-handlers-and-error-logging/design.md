## Context

Event handlers using `on()` from Remix 3 receive native DOM events. The `any` type was used as a shortcut, but the correct types (`KeyboardEvent`, `PointerEvent`) are well-known and provide autocomplete and safety.

Bare `catch {}` blocks exist in the lists controller where expected errors (JSON parse failures, param parsing) are handled with a 400 response but the actual error is never logged. The app has `remix/middleware/logger` installed in the middleware stack, so `context.logger` is available in all action handlers.

## Goals / Non-Goals

**Goals:**
- Replace `any` with `KeyboardEvent` / `PointerEvent` in event handlers
- Add `context.logger` calls to bare catch blocks

**Non-Goals:**
- Changing behavior or response format of the catch blocks
- Refactoring event handling logic

## Decisions

### Decision 1: Use concrete DOM event types

`KeyboardEvent` for keyboard events, `PointerEvent` for pointer events. These are standard DOM types available in TypeScript's `lib.dom.d.ts`.

### Decision 2: Use `context.logger` not `console.log`

The app already has `Logger` from `remix/middleware/logger` wired in the middleware stack at `root.ts:28`. Using `context.logger` ensures log entries go through the app's configured logging pipeline, consistent with how the rest of the app handles request logging.
