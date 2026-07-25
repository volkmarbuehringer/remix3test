## Context

The workflow agent is a two-phase system: an LLM agent resolves natural-language intent into structured JSON, then a Mastra workflow executes the action (cancel/lock/unlock user) with a confirmation gate. Currently the agent has no memory (`tools: {}`, no memory config) and each request is stateless. After the workflow completes via SSE streaming, the result is sent directly to the client — the agent never learns what happened.

## Goals / Non-Goals

**Goals:**

- Agent remembers conversation context across turns within an admin session (per-admin thread)
- After workflow execution, a structured result summary is appended to the agent's thread
- The feedback call is best-effort and does not block the SSE stream from closing
- Same feedback pattern works for both the action-start path (POST /workflow-agent) and the resume path (POST /workflow-agent/resume)

**Non-Goals:**

- Agent does not execute actions or call tools — it remains an intent resolver only
- No UI changes to the status bar or confirmation card
- No changes to the workflow step definitions themselves
- No topic detection or automatic thread rotation

## Decisions

### D1: Per-admin thread key (`admin-{userId}`)

Thread identity is stable per admin, not per session. This means the agent can answer "what did I do yesterday?" from accumulated history. The thread accumulates across browser sessions and logins.

**Alternatives considered:**

- **Per-session (cookie-based):** Cleaner boundaries but loses history on re-login. An admin's work is not sensitive conversation — it's operational history worth keeping.
- **Per-topic:** Hardest to manage — requires topic boundary detection, which is an LLM call in itself.

### D2: Mastra `Memory` with default config

Mastra's built-in `Memory` (backed by PostgresStore) handles thread persistence. No custom storage layer needed.

```ts
import { Memory } from '@mastra/memory'

// In agent config:
memory: new Memory({
  options: {
    workingMemoryLifetime: 30, // keep last 30 turns in active context
    lastMessages: 10,          // include last 10 messages in prompt
  },
})
```

### D3: Result feedback via a second `generate()` call in the start callback

The `ReadableStream.start()` callback lives on the server after the HTTP Response is returned. After `pipeWorkflowStream` finishes and the controller closes, the callback continues — this is where the feedback call runs.

```ts
start: async (controller) => {
  // Phase 1: intent resolution
  let intent = await agent.generate(message, { memory: { thread: threadId } })

  // Phase 2: workflow execution
  let result = await pipeWorkflowStream(stream, controller, signal)  // returns summary

  // Phase 3: feedback (best-effort, after SSE complete)
  controller.close()
  try {
    await agent.generate(`Workflow result: ${JSON.stringify(result)}`, {
      memory: { thread: threadId },
    })
  } catch {
    // Non-blocking — admin already saw the result in the UI
  }
}
```

### D4: `pipeWorkflowStream` returns a result summary

Currently `pipeWorkflowStream` returns `void`. It already captures `lastReportPdf`/`lastReportFilename` internally. We extend it to return a structured summary object extracted from the `workflow-finish` event:

```ts
type WorkflowResult = {
  success: boolean
  action: string
  targetUserId: number
  targetUserName: string
  targetUserEmail: string
  deletedAppointments?: number
  auditLogged?: boolean
  error?: string
}
```

### D5: Explicit thread passthrough in the controller

Thread ID is derived from `getCurrentUser().id` and passed explicitly to every `agent.generate()` call. It is not stored in session — the per-admin key is deterministic:

```ts
let threadId = `admin-${getCurrentUser().id}`
```

## Risks / Trade-offs

- **[Unbounded thread growth]** Each workflow result adds to the thread. Over weeks/months, context pressure increases.
  → Mitigation: `workingMemoryLifetime: 30` keeps only recent turns. Workflow results are single-line summaries (~100 chars each), so even 100 results take ~10k tokens.
- **[Feedback call fails silently]** If the post-workflow `generate()` errors, the admin already saw the SSE result — they won't notice.
  → Acceptable by design (best-effort). Logged to console for debugging.
- **[Thread IDs collide across environments]** `admin-{userId}` is the same in dev, staging, prod if the same user ID exists.
  → Mitigation: prefix with `NODE_ENV` or `APP_ENV` to scope threads: `admin-${process.env.APP_ENV || 'dev'}-${userId}`.
- **[Resume path duplication]** The resume handler (`/workflow-agent/resume`) also calls `pipeWorkflowStream`. It needs the same feedback pattern.
  → Acceptable — the pattern is identical, sharing the same helper functions avoids drift.
