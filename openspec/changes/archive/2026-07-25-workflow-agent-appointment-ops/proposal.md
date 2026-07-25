## Why

The workflow agent can already navigate to `/verwaltung/appointments` with raw filter/period/status params, but it cannot resolve user identity before navigating. This means "show appointments for John" dumps a text search across title + email + resource, not a user-scoped view. And there is no way to batch-delete a user's appointments on a specific resource — an operation admins need for cleanup workflows.

## What Changes

1. **Add user resolution to appointment checks** — Before navigating to `/verwaltung/appointments`, the workflow agent controller resolves the target user via `resolveTargetUser()` and uses the resolved email as the `filter` query param, giving a precise user-scoped view.
2. **Add `delete-resource` appointment action** — A new intent sub-action that deletes all upcoming appointments for a given user on a given resource, using a multi-step Mastra workflow with a confirmation gate.
3. **Evolve the workflow agent's intent schema** — The LLM agent returns structured JSON with an explicit `action` field (`check` or `delete-resource`) and `resourceQuery` for the deletion path.

## Capabilities

### New Capabilities
- `workflow-agent-appointment-user-resolution`: Resolve a named user before navigating to the appointments page — turns "show appointments for John" into a filtered view of John's appointments via email match.
- `workflow-agent-appointment-delete-resource`: Delete all upcoming appointments for a specific user on a specific resource, with a confirm-gate workflow.

### Modified Capabilities
- `workflow-agent-appointment-queries`: The existing spec's intent schema changes — `filter` becomes a resolved field (not raw LLM output) and a new `action` discriminator is added alongside `check`/`delete-resource`.

## Impact

- **`app/actions/mastra/agents/workflow-agent.ts`** — Rewrite instructions with new schema
- **`app/actions/workflow-agent/controller.tsx`** — Add `delete-resource` dispatch path, user resolution for `check` action, resumable workflow integration
- **`app/actions/mastra/index.ts`** — Register new `deleteUserAppointmentsWorkflow`
- **`app/actions/mastra/workflows/delete-user-appointments.ts`** — New 4-step workflow (preflight → confirm-gate → execute → finalize)
- **`app/actions/workflow-agent/workflow-sse.ts`** — MAY need minor extension if workflow output shapes differ
