# Resume/Abort Race

## What This Covers

The SSE resume/abort race when a client aborts a stream and then resumes a suspended Mastra workflow. Read this when using `closeOnSuspend: false` with SSE and server-side state (Map/cache) tracking the workflow.

## Problem

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

## Solution

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

## Alternative: Don't clean up the map on abort

If the map only stores small string values (no memory pressure), simply don't delete entries on abort. The map entry survives the race:

```typescript
// In the stream handler — just skip the delete
workflowRunMap.set(stream.runId, 'myWorkflow')
// ... pipe stream ...
// DON'T: workflowRunMap.delete(stream.runId) — races with resume
```

## Root Cause

The browser's `abortStream()` cancels the original fetch, which aborts the server's request signal. The abort handler in `pipeWorkflowStream` runs asynchronously. The resume POST arrives at the server before or after this abort handler runs — there is no guaranteed ordering.
