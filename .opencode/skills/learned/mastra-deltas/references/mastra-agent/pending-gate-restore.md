# Restore a Suspended Mastra Agent Gate After Reload

**Source:** `mastra-agent-pending-gate-restore`

**Extracted:** 2026-09-14
**Context:** Remix 3 + Mastra agent chat (`/chat` customer, `/admin/support-agent` admin) over SSE. The agent suspends on `ask_user` (question) or `requireToolApproval` (tool decision); the client resumes by `runId`.

## Problem

The gate card is rendered **only** from the live SSE event (`question` / `suspension`). The durable run→owner pointer (`chat_runs`, see `references/durable-run-ownership.md`) keeps ownership working but stores no gate payload, and the index rehydrates the transcript through `messageContentToText`, which keeps only `text` parts. After a reload (or a dropped stream) the card is gone: the page shows just the model's prose and the composer starts a **new** turn instead of resuming the suspended run.

Symptoms:

- "no dialog shown, the answer must be typed"
- the raw `{ "question": … }` appears as a tool card (the `ask_user` args) with no question card
- the ownership row still exists (the run looks suspended) but `/chat/answer` is never called
- an `ask_user` call **without `options`** renders a free-text input by design — that is a prompt problem, not a missing card

## Solution

Persist a **per-actor pointer to the gate payload**, mirroring `support_agent_pending_gates` (`user_id` PK), and add a `reconnect` endpoint the client calls on mount.

```sql
CREATE TABLE IF NOT EXISTS chat_pending_gates (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'suspended')),
  tool_call_id TEXT, tool_name TEXT, args JSONB,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('tool_decision', 'question')),
  suspend_payload JSONB,
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
);
```

Rules (same shape as the ownership pointer):

1. `upsertPendingGate(actor, {runId, threadId})` on run start (status `running`, clears stale fields) — a new turn supersedes an older suspended gate.
2. `markGateSuspended(actor, {runId, threadId, gateType, toolCallId, toolName, args, suspendPayload})` from the `pipeStream` `onSuspension` hook **and** the explicit `finishReason === 'suspended'` branches of approve/decline. Make it an upsert so a missing running row still records.
3. `clearPendingGate(actor, runId)` on any non-`suspended` terminal reason — guarded by run id so a newer gate survives.
4. `resolvePendingGate(actor)` **joins the ownership table** and filters `status = 'suspended'`, so a gate whose run already settled is never surfaced: `JOIN chat_runs r ON r.run_id = g.run_id AND r.user_id = g.user_id`.

Reuse one `gateHooks({actor, threadId, runId, onEnd})` helper across the initial stream, tool-decision, and answer streams — do not copy the hook three times.

Reconnect endpoint (auth-scoped, JSON): `{status:'none'}` or `{status:'suspended', runId, threadId, gateType, toolCallId, toolName, args, suspendPayload}`.

Client (the clientEntry that owns the gate UI), in the mount ref:

```ts
void checkReconnect()

async function checkReconnect() {
  let res = await fetch('/chat/reconnect')
  if (!res.ok) return
  let data = await res.json()
  if (data.status !== 'suspended') return
  setFormEnabled(false)               // block new turns until resolved
  if (data.gateType === 'question') showQuestion({ runId: data.runId, ...data.suspendPayload })
  else showApproval({ runId: data.runId, toolName: data.toolName, args: data.args })
}
```

The admin support agent already had this (`support_agent_pending_gates` + `/reconnect`); the customer `/chat` did not. When one surface is reported broken, check whether the other has logic it is missing.

## Diagnosing "no dialog"

1. Confirm the gate suspended — inspect Mastra storage: `mastra_messages.content.parts` should have a `tool-invocation` with `state: 'call'` (a `result` state means it executed instead).
2. Confirm the server event: the SSE POST body should contain `event: question` (or `event: suspension`). `agent-sse.ts` forwards `question` only for a `tool-call-suspended` chunk whose `payload.suspendPayload.question` is set.
3. `ask_user` with no `options` → free-text card. Model-facing tool names come from the registry key (`agent.listTools()` shows `askUserTool` for id `ask_user`), but Mastra resolves a tool call by registry key **or** `tool.id` fallback, so that mismatch is cosmetic.

## When to Use

- A suspended `ask_user`/approval card disappears after reload and the user must retype
- Adding a customer-facing Mastra chat that needs the reconnect the admin surface already has
- A run is suspended server-side but has no UI action to resume it
