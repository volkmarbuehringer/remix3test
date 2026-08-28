## 1. Schema

- [x] 1.1 Add `admin_active_runs` table (`admin_user_id` PK referencing `users(id)` ON DELETE CASCADE, `run_id`, `workflow_id`, `status`, `step_id`, `suspend_payload` JSONB, `created_at`, `updated_at`) and `admin_active_runs_run_id_idx` to `db/schema.sql`, and verify the app boots with the schema applied (`npm run typecheck` + a test that calls `initializeAppDatabase`)

## 2. Store module

- [x] 2.1 Create `app/actions/agent-events/active-run-store.ts` with `upsertActiveRun`, `markSuspended`, `clearActiveRun` (guarded by run id), `findActiveRun`, and `findRunOwner`, using the existing `db` from `app/db.ts`, and verify `npm run typecheck` passes
- [x] 2.2 Add unit tests for the store covering upsert, mark-suspended, guarded clear (run A finishing must not clear run B), find, and find-owner, and verify they pass via `npm test`

## 3. Stream lifecycle hook

- [x] 3.1 Add the optional `onRunState` callback to `pipeWorkflowStream` in `app/actions/workflow-agent/workflow-sse.ts` (phases: `started`, `suspended`, `finished`, `error`, `canceled`) and verify the existing workflow-agent/agent-events controller tests still pass unchanged
- [x] 3.2 Add a unit test for `pipeWorkflowStream` asserting `onRunState` fires the expected phases for a fake stream (start → suspended → finished) and verify it passes

## 4. Controller wiring

- [x] 4.1 In `app/actions/agent-events/controller.tsx`, wire the `action` and `resume` paths to maintain the index via `onRunState` (upsert on start, mark-suspended on suspend, clear on finish/error/canceled), and verify the existing POST/SSE controller tests still pass
- [x] 4.2 Add `reconnect: get('/reconnect')` to the `agentEvents` route map in `app/routes.ts` and the `reconnect` action in the controller (lookup `findActiveRun`, verify `wf.getWorkflowRunById(runId).status === 'suspended'`, clear + return `none` when stale, return `{ status: 'suspended', runId, workflowId, stepId, suspendPayload }` otherwise), and verify `npm run typecheck` passes
- [x] 4.3 Harden the `resume` action with a durable `findActiveRun` fallback for workflow id resolution, and verify a resume test covering the "restart, no in-memory map" path passes
- [x] 4.4 Reconnect must NOT treat a live `running` snapshot as stale (keep the row, return `none`), and must source the gate payload from the snapshot when the index payload is NULL (mid-flight reload window) — covered by the "still-running snapshot" and "NULL index payload" reconnect tests
- [x] 4.5 `resume` enforces run ownership via `findRunById(runId)` (reject cross-admin resume) and resolves the workflow for the specific run id, not the admin's current active run — covered by the cross-admin resume rejection test

## 5. Route tests

- [x] 5.1 Add controller tests for `GET /admin/agent-events/reconnect`: unauthenticated redirect, `none` when no index row, `suspended` with payload when a suspended run exists, and stale-index-cleared-to-`none` when the snapshot no longer reports suspended, and verify they pass via `npm test`
- [x] 5.2 Add reconnect edge tests: still-running snapshot keeps the row, NULL index payload recovers from the snapshot, and a resolver throw clears the index without a 500

## 6. Client

- [x] 6.1 In `app/assets/streams/public/agent-events-stream.tsx`, add a mount-time reconnect check (fetch `routes.admin.agentEvents.reconnect.href()`, set `currentRunId`/`currentWorkflowId` and call `showConfirmGate` when suspended), and verify via the existing agent-events browser test (`app/assets/streams/agent-events.test.browser.tsx`) plus a manual reload-through-gate pass

## 7. Integration verification

- [x] 7.1 Run the full agent-events test suite (`npm test` filtered to agent-events) and `npm run typecheck` green, and manually verify the reload-during-confirm-gate flow re-renders the gate and confirm/cancel resumes the run