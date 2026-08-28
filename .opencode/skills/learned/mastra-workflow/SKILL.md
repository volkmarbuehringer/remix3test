---
name: mastra-workflow
description: 'Mastra Workflow pitfalls — SSE resume/abort race with server-side state, and strict step schema type compatibility in .parallel()/.then() chains'
origin: consolidated
---

# Mastra Workflow Patterns

**Consolidated from:** `mastra-workflow-resume-abort-race`, `mastra-workflow-step-type-compatibility`

Covers two aspects of Mastra Workflows:
1. The SSE resume/abort race when client aborts a stream then resumes a suspended workflow
2. Strict TypeScript schema compatibility between workflow steps in `.parallel()` and `.then()` chains

---

## Part 1: Resume/Abort Race

### Problem

When using Mastra workflows with `closeOnSuspend: false` and SSE streaming:

1. Client POSTs to start a workflow → server streams SSE events via `run.stream()`
2. Workflow hits a `suspend` step → stream pauses (not closed)
3. Client displays confirm/cancel UI
4. User clicks confirm → client calls `abortStream()` (cancels the original fetch) → then POSTs to `/resume`
5. Server detects the aborted request → `pipeWorkflowStream` returns → cleanup runs (e.g., `Map.delete`)
6. Resume handler starts → tries to read the Map entry → it's gone → fallback to wrong workflow → crash

The cleanup step races with the resume request. Sometimes the resume reads the map first (works), sometimes the cleanup runs first (fails).

```
Client                          Server
  │                               │
  │  POST /workflow (SSE)         │
  │──────────────────────────────▶│  run.stream(closeOnSuspend: false)
  │                               │
  │  SSE: workflow-step-suspended │
  │◀──────────────────────────────│
  │  [User clicks confirm]        │
  │  abortStream()                │
  │  │                            │
  │  │  request signal abort─────▶│  cleanup → Map.delete(entry)
  │  │                            │
  │  POST /workflow/resume        │
  │──────────────────────────────▶│  Map.get(entry) → undefined ✗
  │                               │  → wrong workflow → error
```

### Solution

**Do not rely on server-side state that gets cleaned up on request abort.** Instead, pass the workflow ID through the SSE events to the client, and have the client send it back on resume.

#### 1. Include `workflowId` in the SSE `start` event

```typescript
// Server: when starting a workflow run
controller.enqueue(sseEvent('start', {
  runId: stream.runId,
  workflowId: 'myWorkflow'  // ← explicit, survives abort/cleanup
}))
```

#### 2. Store `workflowId` client-side

```typescript
// Browser SSE handler
let currentWorkflowId: string | null = null

// In the SSE parser:
if (eventType === 'start') {
  currentRunId = parsed.runId || null
  currentWorkflowId = parsed.workflowId || null  // ← store it
}
```

#### 3. Send `workflowId` back on resume

```typescript
// Browser resume handler
async function handleResume(confirmed: boolean) {
  let body = new FormData()
  body.set('runId', currentRunId)
  body.set('confirmed', String(confirmed))
  body.set('workflowId', currentWorkflowId || '')  // ← send it back
  startStream('/workflow/resume', { method: 'POST', body })
}
```

#### 4. Use `workflowId` from the request on the server

```typescript
// Server resume handler
let workflowId = context.formData.get('workflowId')?.toString()
let wfId = workflowId || fallbackMap.get(runId) || 'defaultWorkflow'
let wf = mastra.getWorkflow(wfId)
```

### Alternative: Don't clean up the map on abort

If the map only stores small string values (no memory pressure), simply don't delete entries on abort. The map entry survives the race:

```typescript
// In the stream handler — just skip the delete
workflowRunMap.set(stream.runId, 'myWorkflow')
// ... pipe stream ...
// DON'T: workflowRunMap.delete(stream.runId) — races with resume
```

### Root Cause

The browser's `abortStream()` cancels the original fetch, which aborts the server's request signal. The abort handler in `pipeWorkflowStream` runs asynchronously. The resume POST arrives at the server before or after this abort handler runs — there is no guaranteed ordering.

---

## Part 2: Step Schema Type Compatibility

### Problem

Mastra Workflows enforce strict TypeScript type compatibility between step schemas:

1. **`.parallel([stepA, stepB])`** — All parallel steps must have input schemas compatible with the workflow's `inputSchema`. A step declared with `inputSchema: z.object({})` (empty schema) cannot be placed in a parallel array where the workflow input is `{ targetUserId: number }`. TypeScript error:
   ```
   Property 'targetUserId' is missing in type 'Record<string, never>'
   ```

2. **`.then(stepA).then(stepB)`** — Step B's `inputSchema` must be compatible with Step A's `outputSchema`. If Step A outputs `{ found, user }` and Step B expects `{ targetUserId }`, TypeScript errors.

### Solution

**Option A: Compose workflows at the executor level (recommended)**

Instead of trying to fit incompatible steps into a single workflow, run separate workflows in parallel from the executor and combine their outputs:

```typescript
// workflow-executor.ts
export async function executeCombinedWorkflow(input: {
  targetUserId: number
}): Promise<CombinedResult> {
  let [resultA, resultB] = await Promise.all([
    (async () => {
      let wf = _mastra.getWorkflow('workflowA')
      let run = await wf.createRun({ resourceId: String(input.targetUserId) })
      return run.start({ inputData: input })
    })(),
    (async () => {
      let wf = _mastra.getWorkflow('workflowB')
      let run = await wf.createRun({ resourceId: 'static-key' })
      return run.start({ inputData: {} })
    })(),
  ])
  return { ...resultA, ...resultB }
}
```

**Option B: Merge steps with compatible schemas**

If the steps are logically sequential and share the same input context, merge them into a single step:

```typescript
const combinedStep = createStep({
  id: 'lookup-and-count',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    user: z.object({ ... }).optional(),
    pendingCount: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let user = await lookupUser(inputData.targetUserId)
    let count = await countAppointments(inputData.targetUserId)
    return { found: true, user, pendingCount: count }
  },
})
```

**Option C: Sequential chain with passthrough**

Make earlier steps pass through fields needed by later steps in their output schema:

```typescript
.then(step1) // outputs { found, user, targetUserId (passthrough) }
.then(step2) // expects { targetUserId }
```

---

## Part 3: Reader Cancellation Does Not Abort the Run

### Problem

A client reload / page close cancels the SSE reader. Because `stream()` /
`resumeStream()` call `_start()` and the `ReadableStream` only *watches*
events, cancelling the reader does **not** abort the workflow run — the run
continues executing server-side and can still suspend and persist its snapshot.

This silently breaks "reconnect-on-reload" designs: a reload mid-flight leaves
the index row `running` with a `NULL` suspend payload while the snapshot later
becomes `suspended`. Treating `running` as stale (clearing the row) orphans the
gate even though the run is recoverable.

```
Client reloads
  → SSE reader cancelled (request signal aborts)
  → pipeWorkflowStream returns on signal.aborted
  → onRunState never fires markSuspended
  → BUT _start() continues in the background
  → run reaches confirm gate, suspends, snapshot persists
  → index row: status='running', suspend_payload=NULL
  → snapshot: status='suspended' with gate payload
```

### Solution

1. **Never treat a live `running` snapshot as stale.** On reconnect, a
   `running` status means "still in flight" — keep the index row and surface
   nothing; a later reconnect recovers it. Only clear the row when the run is
   gone from storage or terminal (`success`/`failed`/`canceled`).
2. **Source the gate payload from the snapshot, not the index.** The SSE loop
   can die before `markSuspended` runs, so the index payload may be `NULL` while
   the snapshot is already `suspended`. Fall back to the snapshot's suspended
   step payload (`row.suspendPayload ?? snapshot.suspendPayload`); the snapshot
   `steps` retain it per step (`status === 'suspended'`).
3. **Treat a resolver failure as "run unavailable", not a 500.** Unknown
   workflow id or storage down → clear the stale pointer + return `none`.

```typescript
// reconnect handler
let run = await resolver(workflowId, runId).catch(() => null)
if (!run) { await clear(row); return none }        // gone → stale
if (run.status === 'running') return none           // in flight → keep row
if (run.status !== 'suspended') { await clear(row); return none } // terminal
let payload = row.suspendPayload ?? run.suspendPayload  // NULL-payload window
```

### When to Use

- Building a reconnect / re-attach flow for a suspended Mastra workflow gate
- The client cancels the SSE stream (reload, nav away) and you later need to
  recover the run state from the snapshot
- An index/cache row says `running` but the snapshot says `suspended`

---

## When to Use

- You are using Mastra workflows with `closeOnSuspend: false` and SSE
- You have a client-side resume flow where the original SSE connection is aborted before a new one is created
- You are using server-side state (Map, cache, etc.) to track which workflow a run belongs to
- The resume handler needs to know which workflow object to call `createRun({ runId })` on
- TypeScript errors about `inputSchema` incompatibility in `.parallel()` arrays
- TypeScript errors about output/input mismatch across `.then()` chains in Mastra Workflows
- You need to run system-wide queries (no specific input) alongside user-specific queries in parallel
- You want to reuse existing Mastra Workflow steps defined with `z.object({})` input in a workflow that has structured input
- You are building a reconnect / re-attach flow for a suspended Mastra workflow gate
- The client cancels the SSE stream (reload, nav away) and you later need to recover the run state from the snapshot
- An index/cache row says `running` but the snapshot says `suspended`

## Related Skills

- `mastra-agent` — SSE streaming transport shared with workflow streaming
- `mastra-tools` — confirmation-gate tools (`requireApproval`, `ask_user`) that suspend agents and workflows
