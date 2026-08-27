## Why

`/admin/workflowagent2` (the Agent-Events page) still confirms destructive user actions through an in-process `pendingConfirmMap` — 5-minute TTL, single-process only, lost on restart. `workflow-agent` solved the same problem with a durable Mastra `suspend`/`resume` gate (Postgres-backed via `PostgresStoreVNext`). We also agreed to keep both agent routes rather than consolidate them, so the gap is pure duplication of effort: agent-events should get the same durable, preflight-aware confirm it already has the UI for, while keeping its distinct EventBus diagnostic pipeline.

## What Changes

- **BREAKING** Rename the Agent-Events route slug `workflowagent2` → `agent-events` everywhere it is spelled literally, matching the already-canonical route key (`agentEvents`), frame name (`agent-events-panel`), nav label, and route-label. `routes.ts`, the stream's hardcoded `/admin/workflowagent2` URLs, and specs/tests that assert the path.
- Replace agent-events' in-controller confirm gate with a real Mastra `suspend`/`resume` using the existing `userManagementWorkflow` (the same suspend-capable workflow `workflow-agent` runs), so the gate carries the preflight payload (`targetUserName`, `pendingCount`, `lockedTotal`, `activeTotal`) and survives process restart via Mastra storage.
- The EventBus stays the pre-dispatch diagnostic pipeline (validate → classify → resolve → dispatch) and hands the actionable intent off to the workflow run; `confirm-required`/`confirm.resolved` re-entry and `pendingConfirmMap` are removed for the actionable path.
- `resume` becomes a re-attach to the run (`run.createRun({runId})` + `run.resumeStream({resumeData:{confirmed}})`), matching `workflow-agent`.
- The PDF report step produced by `userManagementWorkflow` is not surfaced or consumed by agent-events (report output is out of scope); it is not stripped from the shared workflow.

## Capabilities

### New Capabilities
- `agent-events-confirm-execute`: durable Mastra suspend/resume confirm gate in the agent-events pipeline — handler that starts the run, surfaces the suspension with preflight data, and resumes the same run on admin confirm/cancel.

### Modified Capabilities
- `admin-agent-routes`: the Agent-Events route path changes from `/admin/workflowagent2` to `/admin/agent-events` (index, `/panel`, sidebar item, frame target, route-label); both agent routes continue to be served under `/admin`.

## Impact

- `app/routes.ts` — `route('workflowagent2', ...)` → `route('agent-events', ...)`.
- `app/actions/agent-events/controller.tsx` — rework `action` to start+pipe the run and `resume` to re-attach; remove `pendingConfirmMap`, `nextConfirmRunId`, `CONFIRM_TTL`.
- `app/actions/agent-events/handlers/dispatch.ts` — emit the workflow to start instead of `action.running` → in-memory confirm; `confirm.ts`/`execute.ts` become unused for the actionable path (candidate for removal).
- `app/assets/streams/public/agent-events-stream.tsx` — hardcoded `/admin/workflowagent2` → `/admin/agent-events`; render the gate from `suspendPayload`; track `currentRunId`.
- `app/actions/mastra/workflow-executor.ts` — `executeCancelUserWorkflow`/`executeLockUserWorkflow`/`executeUnlockUserWorkflow` may become unreferenced from agent-events; verify before removing.
- Tests: `app/actions/agent-events/controller.test.ts` and any path-asserting browser tests.
- DB/state: `PostgresStoreVNext` (Mastra storage) becomes the confirm-state holder for agent-events; plain in-memory map removed.
