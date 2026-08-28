## Why

The agent-events confirm gate is durable (the workflow run suspends and persists to `mastra_workflow_snapshot`), but the pointer to that run is not: the client holds `currentRunId` in a JS closure and the server holds `workflowRunMap` in process memory. A page reload, a different browser, or a server restart orphans a suspended run — the admin loses the confirm gate even though the run is still suspended and resumable. Reconnect-on-reload requires a per-admin durable run index in Postgres plus a reconnect endpoint that re-surfaces the suspended gate.

## What Changes

- Add `admin_active_runs` table to `db/schema.sql`: one row per admin (PK `admin_user_id`), holding the current active run pointer (`run_id`, `workflow_id`, `status`, `step_id`, frozen `suspend_payload`) with upsert semantics
- Add an injectable `active-run-store` module with upsert/mark-suspended/clear/find operations, mirroring the existing `__setRunFactory` test seam
- Extend `pipeWorkflowStream` with an optional `onRunState` lifecycle callback so run start/suspend/finish/error/canceled events update the index in one place
- Add `GET /admin/agent-events/reconnect` route + controller action that looks up the admin's active run, verifies against the Mastra snapshot (the source of truth), and returns the suspended run's `runId`, `workflowId`, `stepId`, and `suspendPayload` as JSON
- Update the `agent-events-stream.tsx` client to check reconnect on mount and re-render the confirm gate from the returned payload
- Harden the `resume` action with a durable `findActiveRun` fallback for workflow id resolution after a server restart
- The `workflow-agent` `/stream` reconnect endpoint remains dead code; it is not part of this change's scope (noted for a follow-up convergence)

## Capabilities

### New Capabilities

- `agent-events-reconnect`: The agent-events admin pipeline re-attaches to a suspended workflow run after a page reload, browser change, or server restart, re-surfacing the durable confirm gate to the admin.

### Modified Capabilities

<!-- None -->

## Impact

- `db/schema.sql` — new `admin_active_runs` table + index
- `app/routes.ts` — `reconnect: get('/reconnect')` added to the `agentEvents` route map
- `app/actions/agent-events/controller.tsx` — `reconnect` action, `resume` hardening, write-path wiring to `onRunState`
- `app/actions/agent-events/active-run-store.ts` — new store module (injectable for tests)
- `app/actions/workflow-agent/workflow-sse.ts` — `onRunState` callback added to `pipeWorkflowStream` (backward-compatible optional param)
- `app/assets/streams/public/agent-events-stream.tsx` — reconnect check on mount
- `app/actions/agent-events/controller.test.ts` — tests for reconnect + store
- No changes to Mastra workflows, the event-bus handlers, or the SSE event vocabulary