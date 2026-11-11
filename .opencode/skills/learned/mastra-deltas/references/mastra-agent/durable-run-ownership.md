# Durable Run Ownership for Agent Suspend/Resume

**Source:** `mastra-durable-run-ownership`

**Extracted:** 2026-08-28
**Context:** Remix 3 + Mastra chat where the agent suspends for tool approval or a question and the client resumes by `runId`; ownership must survive restart/scale.

## Problem

Mastra runs can suspend mid-flow and the user resumes by `runId`. Gating "who may act" with an in-memory Map is process-local: lost on restart, not shared across instances, and awkward across re-suspensions. The old pattern buffers the stream in an in-memory `stream-store` and serves a `GET /chat/stream/:runId` + parallel `verifyStreamOwner` Map — both break on restart/scale and leak.

## Solution

Persist a durable pointer row: `run_id` (PK) → `user_id` (+ `thread_id`, `created_at`). This is the app-side analog of the existing `admin_active_runs` pointer. Do **not** reuse `admin_active_runs` (it is a per-admin active pointer keyed by `admin_user_id`/`workflow_id`/`status`) — you need a run→user mapping for a user-scoped flow.

Look it up by `run_id` for the ownership gate (403 on mismatch). Record on run start / continuation; delete on terminal.

### Three rules that matter

1. **Record on start AND on every continuation.** If approve/decline/answer yields a continuation run, record the new run's ownership before returning; otherwise a follow-up on the continuation is 403.
   ```ts
   if (result.runId && result.runId !== runId) {
     await recordChatRun({ runId: result.runId, userId, threadId })
   }
   ```

2. **Only clear the incoming run when a DISTINCT continuation run was created.** Clearing the incoming `runId` unconditionally after a resume deletes the row you still need when the same run re-suspends (`output.runId === runId`) — turning a legitimate follow-up into a 403.
   ```ts
   if (output.runId !== runId) {
     await recordChatRun({ runId: output.runId, userId, threadId })
     await clearChatRun(runId)   // only the resolved suspension, when a new run took over
   }
   ```
   A stale row (leak) is cheaper than a false 403; TTL cleanup is a deferred concern.

3. **Idempotent, parameterized insert:** `INSERT ... ON CONFLICT (run_id) DO NOTHING`, all values bound (`$1`/`$2`), never concatenated.

4. **A cancelled SSE body must not record a new pointer.** Since remix #12190 the router cancels an abandoned response body; the stream's `cancel()` aborts the run signal. The durable engine (`app/utils/agent-chat-durable.ts`) checks `signal.aborted` — the run signal its `sseRunResponse()` body callback receives — after `agent.stream()`/`resume()` resolves and returns with `endReason = 'aborted'` **before** `recordRun`/the continuation insert, so a client that left before the run id existed leaves no ownership row; the stream's `finally` still clears the incoming run and calls the durable handle's `cleanup()` (the helper owns the signal cleanup and the terminal close). Guard: `app/utils/agent-chat-cancel.test.ts` (cancel the body → abort signal set, `recordRun` never called, cleanup ran).

### Wiring
Add the table as a **new migration** under `db/migrations/<timestamp>_<slug>/` (idempotent `up.sql` + `down.sql`; never edit the baseline) **and** to the `remix/data-table` DSL (`schema.ts` with `primaryKey: ['run_id']`). Back the store module with the singleton `db` (mirror `active-run-store.ts`), and gate the resume routes *before* calling the agent.

## When to Use
- Adding user/actor-scoped ownership gating to Mastra suspend/resume routes.
- Replacing an in-memory stream/ownership store so it survives restart/scale.
- You hit (or want to avoid) a false 403 after a multi-step re-suspended run.
- Prefer this over deriving run→owner from Mastra's PG internals (not a stable query path) or reusing an admin-only active-run pointer.
