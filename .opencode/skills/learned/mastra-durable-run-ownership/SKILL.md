---
name: mastra-durable-run-ownership
description: "Use when an agent-run feature gates approve/decline/answer by who owns the run, when a Mastra suspend/resume flow breaks after a server restart or scale-out, or when a follow-up approve/answer on a re-suspended run returns 403 — persist a durable run→owner pointer instead of an in-memory Map."
metadata:
  origin: auto-extracted
---

# Durable Run Ownership for Agent Suspend/Resume

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

### Wiring
Add the table to **both** `db/schema.sql` (DDL) and the `remix/data-table` DSL (`schema.ts` with `primaryKey: ['run_id']`). Back the store module with the singleton `db` (mirror `active-run-store.ts`), and gate the resume routes *before* calling the agent.

## When to Use
- Adding user/actor-scoped ownership gating to Mastra suspend/resume routes.
- Replacing an in-memory stream/ownership store so it survives restart/scale.
- You hit (or want to avoid) a false 403 after a multi-step re-suspended run.
- Prefer this over deriving run→owner from Mastra's PG internals (not a stable query path) or reusing an admin-only active-run pointer.
