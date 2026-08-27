## Context

`/admin/workflowagent2` (Agent-Events) already has a working confirm gate, but it is a plain in-process `pendingConfirmMap` keyed by a synthetic `runId` and closed after 30s. `workflow-agent` solves the same problem with a real Mastra `suspend`/`resume` gate persisted via `PostgresStoreVNext` and preflight-aware (`targetUserName`, `pendingCount`, `lockedTotal`, `activeTotal`). See `proposal.md - Why`. This design keeps both agent routes (strategy B) and ports the durable confirm into agent-events, so the two pages converge on one confirm mechanism while agent-events keeps its EventBus diagnostic pipeline.

Current seam, for reference:

```
agent-events controller `action`
  → EventBus.run() cascade  (validate → classify → resolve → dispatch → confirm.required → resume re-entry → execute)
  → SSE out

workflow-agent controller `action`
  → agent generate → run.userManagementWorkflow.stream({closeOnSuspend:false}) → pipeWorkflowStream → SSE out
  → resume: run.createRun({runId}) → resumeStream({confirmed})
```

## Goals / Non-Goals

**Goals:**
- agent-events confirms destructive actions through a durable Mastra `suspend` held in `PostgresStoreVNext`, resumable by `runId`, surviving restarts.
- The gate surfaces the preflight payload (name, pending/locked/active totals), not a bare `summary + "?"`.
- The EventBus remains the pre-dispatch diagnostic pipeline and hands the actionable intent to the workflow run; `show-appointments` stays navigate-only.
- `/workflowagent2` slug is renamed to `/agent-events` for consistency (`agentEvents` / `agent-events-panel` / "Agent-Events" are already canonical).
- Reuse `userManagementWorkflow` so both agent pages share one orchestration + one confirm semantics.

**Non-Goals:**
- Adding agent-events' missing `delete-resource` intent (stays with `workflow-agent` per strategy B).
- Surfacing or stripping the PDF report step that `userManagementWorkflow` runs — agent-events ignores `reportPdf`; it is not removed from the shared workflow.
- Consolidating/removing either agent route.

## Decisions

### 1. Reuse `userManagementWorkflow` rather than a purpose-built agent-events workflow
Rationale: the suspend gate, preflight (`userPreflightWorkflow`), and the isolated executors (`cancel/lock/unlockUserWorkflow`) all already live there, and it is exactly what `workflow-agent` runs — durable confirm and one engine for free.

- Alternative considered: clone a report-less `agentEventsUserManagementWorkflow`. Rejected: duplicates orchestration, diverges confirm semantics from `workflow-agent`, and PDF is not important enough to justify it. We simply do not consume `reportPdf`.
- Confirmed: `executeCancelUserWorkflow`/`executeLockUserWorkflow`/`executeUnlockUserWorkflow` stay — they are called by `user-management-workflow.ts:257-276` and `support-tools.ts:707`. Only agent-events' own EventBus `execute.ts`/`confirm.ts` handlers become redundant.

### 2. The EventBus stops at dispatch; the controller owns the run
`dispatch.ts` emits a new semantic event `workflow.requested` (`workflowId`, `input`, `navigate`) instead of `action.running`. The controller's `action` loop, on seeing `workflow.requested`, enqueues the `navigate` SSE, emits `start` (`runId`), then calls `pipeWorkflowStream(run.stream({closeOnSuspend:false}), controller, signal)` and closes after the suspension.

- Alternatives considered:
  - EventBus handler starts the run. Rejected — the `run()` cascade is a fire-once queue and cannot hold a suspended run across a separate HTTP resume.
  - Keep the old `confirm-required`/`confirm.resolved`/`execute` events. Rejected — that is the in-memory gate being replaced.
- Result: handlers decide, the transport/controller orchestrates. New event variant added to `event-bus.ts` `BaseEvent`; `confirm.required` / `confirm.resolved` / `execute` are removed from the actionable path.

### 3. Resume re-attaches to the run; no EventBus re-entry
`resume` accepts `{runId, confirmed}`, does `mastra.getWorkflow('userManagementWorkflow').createRun({runId})` then `run.resumeStream({resumeData:{confirmed}})` and pipes. Because agent-events runs only `userManagementWorkflow`, the resume action can default to it — no `workflowRunMap` needed (unlike `workflow-agent`, which tracks two workflow ids).

### 4. Client renders the gate from `suspendPayload` and tracks `runId`
`agent-events-stream.tsx` tracks `currentRunId` from the `start` event (as `workflow-agent-stream.tsx` does) and renders the gate from the `workflow-step-suspended` event's `suspendPayload` (question, `targetUserName`, `pendingCount`, `lockedTotal`, `activeTotal`) instead of the bespoke `confirm-required` payload. `handleResume` already POSTs `{runId, confirmed}` — only server semantics change.

### 5. Route slug rename
`routes.ts:139` `route('workflowagent2', ...)` → `route('agent-events', ...)`. `agent-events-stream.tsx` hardcoded `/admin/workflowagent2` (2 sites) → `/admin/agent-events`, preferably via `routes.admin.agentEvents...href()`. `route-labels.ts`/`admin-layout.tsx` use `.href()`/route keys and require no edit.

## Risks / Trade-offs

- **`userManagementWorkflow` still generates a PDF report that agent-events ignores** → Accept as a harmless side effect (non-goal); optionally extract a report-less workflow later if it matters.
- **`pipeWorkflowStream` is shared and tracks `reportPdf`/`reportFilename`** → agent-events will receive them in `workflow-finish` but not render them; fine to ignore, or add a mode flag if the coupling is undesirable.
- **Confirm SSE event shape changes** (`confirm-required` → `workflow-step-suspended`) → agent-events-stream's gate builder now matches workflow-agent-stream's, which is an opportunity to unify the two confirm-gate renderers rather than keep duplicate DOM injection.
- **Hardcoded `/admin/workflowagent2` literals** → after the rename, a stray literal elsewhere would break; add an assertion/test that no `/workflowagent2` remains and prefer `routes.*.href()`.
- **Post-dispatch observability shifts from EventBus stages to Mastra `workflow-step-*` events** → the EventBus still owns validate/classify/resolve/dispatch; the tail is inherently Mastra-flavored now. Accept as the intended seam.
- **A suspended run the admin never resumes stays in Postgres indefinitely** → same as `workflow-agent` (durable suspend persists until resumed). Intentionally not fixed with a reaper here: a process-local TTL would regress the durability this change is delivering, and a Postgres reaper is a platform-level concern out of scope. Accept as a shared, documented trade-off; revisit if abandoned runs accumulate.

## Migration Plan

1. Rename slug `workflowagent2` → `agent-events` (`routes.ts`, stream literals, tests, `admin-agent-routes` delta spec). Low risk, isolated.
2. Swap the confirm mechanism: add `workflow.requested`, remove in-memory confirm, rework `resume` to re-attach, update stream event handling.
3. Remove dead EventBus `confirm`/`execute` handlers; run full test suite and typecheck.
4. Rollback: each is a separate commit; the suspend swap can revert to the in-memory map without touching the rename.

## Open Questions

- Pass `workflowId` on `resume` for parity, or hardcode `userManagementWorkflow`? (Implementation detail; does not change specs.)
- Unify the agent-events-stream and workflow-agent-stream confirm-gate DOM builders, or keep them separate for now? (Deferrable.)
