## Why

The `/workflowagent2` (agent-events) route has a complete event pipeline — validation, keyword-based intent classification, entity resolution, SSE streaming, confirm gates with admin approval UI, and frame navigation. But the `execute` handler is a stub that unconditionally returns success without performing any actual action. The pipeline can decide to cancel/lock/unlock a user but can't execute it.

## What Changes

- **`handlers/resolve.ts`** — Add real database lookup for user resolution instead of string-pattern matching. Uses same logic as the Mastra workflow agent's `resolveTargetUser()`: query by ID, then by name/email with ILIKE. Returns `entities.notfound` when no user matches or multiple match.

- **`handlers/execute.ts`** — Replace the stub with real calls to the existing `workflow-executor.ts`. Maps intents (`cancel-user`, `lock-user`, `unlock-user`) to `executeCancelUserWorkflow()`, `executeLockUserWorkflow()`, `executeUnlockUserWorkflow()`. Returns structured results with success/error and audit info.

- **`controller.tsx`** — Expand `pendingConfirmMap` to store resolved entity context (`intent`, `targetUserId`, `targetQuery`, `adminUserId`, `adminEmail`) alongside the original message. Pass full context into `confirm.resolved` payload so the resume pipeline can execute without re-resolving.

- **`handlers/classify.ts`** — (Optional) Add `lookup` intent and `delete-resource` intent keywords to match v1's capability set.

## Capabilities

### New Capabilities
- `agent-events-admin-actions`: Event-driven admin user management actions (cancel/lock/unlock) via the agent-events pipeline. Reuses the same underlying execution layer as the Mastra workflow agent but without LLM dependency for common intents.

### Modified Capabilities
- *(none — this is wiring existing execution to a new pipeline, no spec-level requirement changes)*

## Impact

- **`app/actions/agent-events/`**: Three handler files change (`resolve.ts`, `execute.ts`, `controller.tsx`). The event bus type definitions and SSE streaming layer stay unchanged.
- **`app/actions/mastra/workflow-executor.ts`**: No changes — this is the pure function layer, already importable without Mastra orchestration.
- **Dependencies**: `resolve.ts` imports `db` from `app/data/connection.ts`; `execute.ts` imports workflow-executor functions. No new npm dependencies.
- **Tests**: Existing EventBus unit tests continue passing. `execute.ts` and `resolve.ts` handler tests need updates.
- **No new routes, no new UI** — the `/workflowagent2` page and SSE client stream already work end-to-end.
