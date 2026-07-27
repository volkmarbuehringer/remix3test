## Context

The agent-events pipeline at `/workflowagent2` uses an in-process `EventBus` with typed async-generator event flow. Each HTTP request creates a fresh `EventBus` instance, registers handlers, and streams events as SSE. The pipeline currently produces intents and generates confirm gates, but the `execute` handler is a stub.

The Mastra workflow agent at `/workflow-agent` already implements the real execution layer via `workflow-executor.ts` — standalone async functions that wrap Mastra workflows for cancel/lock/unlock with DB mutations, audit logging, and PDF reporting. These functions take `{ targetUserId, adminUserId, adminEmail }` and return structured results.

The design challenge is bridging the stateless EventBus pipeline to these execution functions while preserving the confirm-gate resume flow.

## Goals / Non-Goals

**Goals:**
- `execute.ts` calls the real workflow-executor functions instead of returning a stub
- `resolve.ts` queries the database to confirm user existence before emitting `entities.resolved`
- Resume flow carries enough context to execute without re-resolving entities
- All existing pipeline behavior (SSE streaming, navigation, confirm gate UI) works unchanged

**Non-Goals:**
- No new intents beyond what the keyword classifier already handles (cancel, lock, unlock, show-appointments)
- No Mastra coupling in the pipeline — the event bus stays framework-independent
- No changes to the EventBus base types, the SSE streaming layer, or the client browser entry
- No changes to the admin sidebar or route registration

## Decisions

### Decision 1: Context payload in pendingConfirmMap

**Problem:** The EventBus is stateless — each `bus.run()` is a fresh pipeline. When the admin confirms, the resume controller creates a *second* pipeline starting at `confirm.resolved`. The handler only receives `{ confirmed, payload: { message } }` — not the resolved intent or entity IDs.

**Chosen approach:** Expand `pendingConfirmMap` to store the full resolved context alongside the original message:

```ts
// Before (current):
pendingConfirmMap.set(runId, { message, expiresAt })

// After:
type ConfirmState = {
  message: string
  intent: string
  targetUserId: number
  targetQuery: string
  adminUserId: number
  adminEmail: string
  expiresAt: number
}
pendingConfirmMap.set(runId, { message, intent, targetUserId, targetQuery, adminUserId, adminEmail, expiresAt })
```

On resume, `confirm.resolved` emits with `payload` containing the full state, so `execute.ts` has everything it needs.

**Alternatives considered:**
- *Re-resolve from message text* — wasteful, re-runs DB queries. Also fragile if the original message encoded the user ambiguously.
- *Store in a module-level Map keyed by intent+target* — more complex, same result. The pendingConfirmMap already provides TTL-based cleanup.

### Decision 2: Real DB lookup in resolve.ts

**Approach:** Mirror `resolveTargetUser()` from v1's `controller.tsx:38-58` exactly:

1. Try parsing `targetQuery` as numeric ID → query `SELECT id FROM users WHERE id = $1`
2. If not a number (or not found by ID), do `SELECT id, name, email FROM users WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY name`
3. 0 results → `entities.notfound`
4. 1 result → `entities.resolved` with `targetUserId`
5. Multiple results → `entities.notfound` with disambiguation message ("Multiple users match... please be more specific")

### Decision 3: Admin context injection

**Problem:** `resolve.ts`, `dispatch.ts`, and `execute.ts` need `adminUserId`/`adminEmail` for audit logging, but the EventBus handlers don't have access to the HTTP request context.

**Approach:** Populate admin info in the initial event. The controller sets it when creating the pipeline:

```ts
let initialEvent: BaseEvent = {
  type: 'request.received',
  message,
  adminUserId: user.id,
  adminEmail: user.email,
}
```

This requires adding optional `adminUserId`/`adminEmail` fields to the `request.received` event type in `event-bus.ts`. Handlers pass these fields through the pipeline in their emitted events. The `resolve.ts` and `execute.ts` handlers read them from their incoming event payload.

### Decision 4: execute.ts calls workflow-executor directly

**Approach:** Import the standalone functions from `app/actions/mastra/workflow-executor.ts`:

```ts
import {
  executeCancelUserWorkflow,
  executeLockUserWorkflow,
  executeUnlockUserWorkflow,
} from '../../mastra/workflow-executor.ts'
```

These functions are simple async wrappers — they accept `{ targetUserId, adminUserId, adminEmail }`, run the Mastra workflow synchronously (start + finish), and return `{ success, workflowRunId, error, ... }`. No SSE streaming needed for v2's `execute.ts` — the pipeline streams status events itself.

`execute.ts` maps intents:
- `cancel-user` → `executeCancelUserWorkflow`
- `lock-user` → `executeLockUserWorkflow`  
- `unlock-user` → `executeUnlockUserWorkflow`

Each call is wrapped in try/catch. On success, emits `action.completed` with the result. On failure, emits `action.completed` with `success: false` and the error.

## Risks / Trade-offs

- **[Coupling]** `execute.ts` imports from the Mastra directory. If the workflow-executor API changes, both agents need updating. Mitigation: workflow-executor functions are stable pure-data wrappers (input → `{success, error, ...}`), not likely to change signature.

- **[Mastra initialization]** `workflow-executor.ts` requires `setMastra()` to have been called before any execute function is invoked. The Mastra instance is initialized at module level in `app/actions/mastra/index.ts`, which is imported by the test setup and server entry. v2's pipeline must run after that initialization. Mitigation: if `_mastra` is not set, the execute function throws `'Mastra not initialized'`, which is caught and emitted as `request.failed`.

- **[In-memory state]** `pendingConfirmMap` is in-process and lost on server restart. If the server restarts while a confirm gate is open, the admin gets "Invalid or expired runId" on resume. This matches v1's behavior (Mastra workflows are also in-memory by default in dev). Acceptable for current scale.

- **[No parallel request tracking]** `workflowRunMap` in v1 tracks runId→workflowId for resume routing. v2's execute handler runs synchronously (await + return), so no map is needed — the result is emitted directly in the same pipeline.

## Open Questions

- Should `execute.ts` emit a `navigate` event to the admin users page on completion, or leave the admin at the current page? v1 navigates to `/admin/users?filter=...` before the workflow starts. v2 already does this in `dispatch.ts`. Post-execution navigation to the user's detail page could be added but is not required for the initial implementation.
