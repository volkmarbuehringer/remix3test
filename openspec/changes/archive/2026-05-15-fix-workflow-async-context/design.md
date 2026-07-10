## Context

The workflow controller (`app/actions/workflow-controller.tsx`) starts workflow execution via fire-and-forget after sending the response:

```typescript
executeWorkflow(runId, { workflowId, params, db, user }).catch(...)
return new Response(null, { status: 303, ... })
```

`executeWorkflow` (in `app/workflows/engine.ts`) immediately calls `userLogger('WorkflowEngine')` which internally calls `getCurrentUserSafely()` → `getCurrentAuth()` → `getContext().auth`. Because this runs after the response is sent, the request-scoped async context may be torn down. If `getContext()` throws, the error propagates to the `.catch()` handler which marks the run as failed — but the workflow never executed.

The `user` object is already passed in `RunWorkflowOptions` from the controller (where it was available in request context). The fix is to create the logger in the controller (before the response) and pass it to `executeWorkflow`.

## Goals / Non-Goals

**Goals:**

- Ensure `executeWorkflow` can log without depending on request-scoped async context
- Eliminate the silent workflow-execution failure caused by the context teardown
- Keep backward compatibility — existing callers unaffected

**Non-Goals:**

- Not fixing the same pattern in `tools.ts` (the tool `execute` functions also call `userLogger`, but fixing those requires deeper changes to how the AI SDK is integrated)
- Not renaming or changing `getCurrentUserSafely` (that's a separate documentation concern)
- Not changing the fire-and-forget execution model itself

## Decisions

| Decision                    | Choice                                                                      | Rationale                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How to pass the logger      | Add optional `logger` field to `RunWorkflowOptions`                         | Backward-compatible, caller can opt in without changing the function signature for existing callers                                                               |
| Where to create the logger  | In the controller's `action` handler, before the `executeWorkflow` call     | The controller has access to request context — the logger is created while context is alive                                                                       |
| Fallback in executeWorkflow | Only create logger via `userLogger()` when `options.logger` is not provided | Preserves backward compatibility for any hypothetical non-request-context callers                                                                                 |
| Tools.ts                    | Leave unchanged                                                             | Tool execute functions are called by the AI SDK and don't receive workflow context. Fixing them would require either module-level state or dynamic tool creation. |

No alternatives were seriously considered — this is a minimal targeted fix.

The controller already has `userLogger('Workflow')` on line 44 (in the `action` handler, before `executeWorkflow`). This same logger can be passed through. The `executeWorkflow` function already receives a `RunWorkflowOptions` object, making the change trivial.

## Risks / Trade-offs

- **[Low] Passing mutable logger reference**: The logger object is a plain `{ log, warn, error }` object — no mutable state, safe to share across async boundaries.
- **[Medium] Tools.ts still has the same problem**: Tool `execute` functions in `tools.ts` create their own `userLogger()` instances. These run inside the same fire-and-forget scope. This is a secondary bug that should be addressed separately. The current impact is low because tools run inside `callLlm()` which IS within the `executeWorkflow` try/catch — a logger throw inside a tool would be caught by the engine's error handling.
- **[None] No behavioral change for in-request callers**: Tests and any direct calls to `executeWorkflow` that are still in-request work identically.
