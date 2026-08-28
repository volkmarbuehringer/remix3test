## Context

The agent-events confirm gate already persists: the workflow run suspends and its snapshot survives in `mastra_workflow_snapshot` (`workflow_name`, `run_id` PK, JSONB `snapshot`, `resourceId` = the *target* user, not the admin). What does not survive is the pointer from admin → run. The client holds `currentRunId` in a JS closure and the server holds `workflowRunMap` in process memory — both lost on reload, browser change, or restart. The legacy `workflow_runs` table (`db/schema.sql`) is dead (nothing writes to it) and is keyed by run id, not admin, so it is not reused.

Both controllers funnel workflow events through the shared `pipeWorkflowStream` helper, which already sees every lifecycle event (`workflow-start`, `workflow-step-suspended`, `workflow-finish`, `workflow-canceled`, and the catch-path error). `wf.getWorkflowRunById(runId)` is the public Mastra API to verify a run's live status from the snapshot. The `agent-events` controller already has an injectable `__setRunFactory` test seam and a `controller.test.ts` that exercises the route over the real Remix test harness.

## Goals / Non-Goals

**Goals:**
- Durable per-admin run index in Postgres, surviving reload, browser change, and server restart
- A reconnect endpoint that re-surfaces a suspended confirm gate without resuming it
- A client mount-time check that re-renders the gate and reuses the existing confirm/cancel path
- Resume works after a restart even when the client lost its closure state

**Non-Goals:**
- Fixing or deleting the dead `workflow-agent` `/stream` reconnect endpoint (that is a convergence follow-up, tracked in the proposal's Impact note)
- Auto-cancelling orphaned runs when a new run supersedes an old one
- Polling to clear stale confirm gates in other browser tabs (handled passively via snapshot verification)
- Making the `workflow-agent` route adopt the tracker (same convergence follow-up)

## Decisions

### D1: New `admin_active_runs` table, not the legacy `workflow_runs`

The legacy table is keyed by run id with no `suspend_payload` column and no current-run semantics; nothing writes to it. A fresh table with PK `admin_user_id` gives natural "one active run per admin" upsert semantics and a place to store the frozen gate payload.

**Alternative considered:** reviving `workflow_runs` — rejected because its shape (run-id PK, no payload column, legacy `steps`/`chain_depth` columns) would need retrofitting and carries dead semantics.

### D2: `suspend_payload` denormalized into the index

The frozen gate payload (question, actionType, targetUserName, pendingCount, resourceName…) is stored in the index row rather than parsed from Mastra's internal snapshot JSON on every reconnect. It is immutable once suspended, so drift is not a concern. The snapshot remains the source of truth for *verification* (is it still suspended?), the payload in the row is the *rendering* data.

**Alternative considered:** parsing the snapshot at read time — rejected as more coupling to Mastra internals with no benefit.

### D3: Lifecycle writes hook into the shared `pipeWorkflowStream` via `onRunState`

`pipeWorkflowStream` already sees every lifecycle event and is already imported by both controllers. Adding an optional, backward-compatible `onRunState` callback means the index is maintained in one place and both routes can adopt it later.

**Alternative considered:** a per-controller wrapper that re-parses the stream — rejected as duplicate logic and drift risk.

### D4: Reconnect is a JSON GET, not an SSE stream

Reconnect is a one-shot lookup, not a stream. The client already has a local `showConfirmGate(payload)`; it needs the payload plus `runId`/`workflowId`, then sets its closures and renders. No need to re-pipe the workflow stream.

### D5: Reconnect verifies against the snapshot before returning

The index is a pointer; `wf.getWorkflowRunById(runId)` is the truth. Reconnect branches on the live snapshot status:
- run gone from storage → clear the index, return `none` (truly stale)
- snapshot still `running` → keep the index, return `none` (a mid-flight reload does not abort the Mastra run — `stream()` continues `_start` in the background and may suspend momentarily, so the pointer must be retained for a later reconnect)
- snapshot `success`/`failed`/`canceled` → clear the index, return `none`
- snapshot `suspended` → return the run with the gate payload

Because the SSE loop dies on reload *before* `markSuspended` can run, the index payload can be `NULL` while the snapshot is already `suspended`. The gate payload is therefore sourced as `row.suspendPayload ?? snapshot.suspendPayload` (the snapshot's suspended step carries it), so a mid-flight reload still recovers the gate. A resolver failure (unknown workflow, storage down) is treated as "run unavailable" → clear + `none`, never a 500.

### D6: `clearActiveRun` is guarded by run id

If admin starts run B while A is suspended (upsert overwrites the pointer to B), A's late `finished`/`error`/`canceled` hook must not clear B's row. The clear is `WHERE admin_user_id = $1 AND run_id = $2`.

### D7: Resume enforces run ownership via the index

`resume` resolves the workflow for the *specific* run id (`findRunById(runId)`), not the admin's current active run — the pointer may have moved to a newer run, and guessing the wrong workflow would re-attach wrong semantics. When the run is indexed, the requesting admin must own it; a cross-admin resume is rejected. Runs with no index row (pre-reconnect flow) are resolved purely from the client/memory, preserving the existing path.

## Risks / Trade-offs

- [Stale confirm gate in another open tab] → The losing tab's already-rendered gate goes stale after the winner resumes; the snapshot verification means any *new* reconnect self-heals to `none`. Acceptable for v1; a `runActive` poll is a possible follow-up.
- [Orphaned suspended runs] → A superseded run stays suspended in `mastra_workflow_snapshot` but is unreachable via the index. Matches current overwrite behavior; auto-cancel is a deliberate non-goal.
- [Shared `pipeWorkflowStream` coupling] → Modifying a helper used by both routes touches workflow-agent's surface. Mitigated by making `onRunState` optional and backward-compatible; the workflow-agent controller is untouched.
- [Mid-flight reload between upsert and suspend] → The snapshot check must not treat a live `running` run as stale (it would delete the pointer the run needs to be recovered); the index is only cleared for runs that are gone or terminal. The client also guards against a late reconnect response clobbering a fresh submission.
- [Index row vs. snapshot divergence] → Always verify before surfacing; the row is only ever a pointer, never authoritative on its own. The gate payload falls back to the snapshot when the index write lost the race.

## Migration Plan

- `db/schema.sql` uses `CREATE TABLE IF NOT EXISTS`; the app applies the schema on boot (`applyAppSchema` in `app/db.ts`), so the new table is created automatically on deploy with no manual migration.
- Rollback: remove the `reconnect` route registration and the mount-time client check; the table can remain harmlessly (empty) or be dropped.
- No data migration needed — the table starts empty.

## Open Questions

None that affect the specs, approach, or task breakdown. The workflow-agent convergence (adopting the tracker, deleting `/stream`) is intentionally deferred and does not change this change's scope.