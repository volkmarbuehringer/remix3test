## Why

`executeWorkflow()` in `app/workflows/engine.ts` is called fire-and-forget from the workflow controller after the response is already sent. But it calls `userLogger('WorkflowEngine')` on line 85, which internally calls `getCurrentUserSafely()` → `getCurrentAuth()` → `getContext().auth`. If the `asyncContext` middleware uses request-scoped `AsyncLocalStorage`, the async store has been torn down by this point and `getContext()` throws. The `.catch()` handler in the controller marks the run as failed in the database, so the user sees an error — but the workflow never actually executes. Meanwhile, the `user` parameter is already available in the `options` object passed to `executeWorkflow`, it's just never passed to the logger.

## What Changes

- Add an optional `logger` parameter to `executeWorkflow()`'s `RunWorkflowOptions`
- Create the logger in the workflow controller's `action` handler (which runs in the request context) and pass it to `executeWorkflow()`
- In `executeWorkflow()`, use the passed-in logger when available, falling back to `userLogger()` only when not provided
- Update `tools.ts` to use the workflow context's logger instead of creating its own via `userLogger()
- No breaking changes — the `executeWorkflow` function signature remains backward-compatible via the optional parameter

## Capabilities

### New Capabilities

No new capabilities — this is a bug fix with no behavioral change.

### Modified Capabilities

None.

## Impact

- **Modified files**: `app/workflows/engine.ts`, `app/actions/workflow-controller.tsx`, `app/workflows/tools.ts`
- **No signature breakage**: The new `logger` parameter is optional — existing callers not affected
- **No test changes**: Behavior is identical when called in-request (which is all existing test paths)
- **No API changes**: No route, middleware, or data model changes
