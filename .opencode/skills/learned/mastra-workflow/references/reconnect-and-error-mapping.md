# Reconnect and Error Mapping

## What This Covers

Two workflow lifecycle traps around a run that finished or suspended without the client watching: reader cancellation does not abort the run (so reconnect logic must not treat `running` as stale), and a failed run's `result.error` is a plain object that stringifies to `[object Object]`.

## Reader Cancellation Does Not Abort the Run

A client reload / page close cancels the SSE reader. Because `stream()` / `resumeStream()` call `_start()` and the `ReadableStream` only *watches* events, cancelling the reader does **not** abort the workflow run — the run continues executing server-side and can still suspend and persist its snapshot.

This silently breaks "reconnect-on-reload" designs: a reload mid-flight leaves the index row `running` with a `NULL` suspend payload while the snapshot later becomes `suspended`. Treating `running` as stale (clearing the row) orphans the gate even though the run is recoverable.

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

1. **Never treat a live `running` snapshot as stale.** On reconnect, a `running` status means "still in flight" — keep the index row and surface nothing; a later reconnect recovers it. Only clear the row when the run is gone from storage or terminal (`success`/`failed`/`canceled`).
2. **Source the gate payload from the snapshot, not the index.** The SSE loop can die before `markSuspended` runs, so the index payload may be `NULL` while the snapshot is already `suspended`. Fall back to the snapshot's suspended step payload (`row.suspendPayload ?? snapshot.suspendPayload`); the snapshot `steps` retain it per step (`status === 'suspended'`).
3. **Treat a resolver failure as "run unavailable", not a 500.** Unknown workflow id or storage down → clear the stale pointer + return `none`.

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
- The client cancels the SSE stream (reload, nav away) and you later need to recover the run state from the snapshot
- An index/cache row says `running` but the snapshot says `suspended`

## Failed-Run `result.error` Is a Plain Object, Not an Error

When a workflow step throws and the run ends `failed`, `run.start()` resolves with `result.status === 'failed'` and `result.error` — but that error is a **plain serialized object, not an `Error` instance** (verified against `@mastra/core` 1.63.0). The common executor mapping silently destroys it:

```ts
error: result.status === 'failed' ? String(result.error) : 'unknown_error'
```

→ `"[object Object]"`. The real message (e.g. `'Audit log write failed; action rolled back'` or a FK-violation detail) never reaches the admin, the SSE report, or a test assertion. The loss happens at the mapping boundary, not at the throw site — a `JSON.stringify(result.error)` probe after the executor showing the string `"[object Object]"` proves the object was already stringified somewhere upstream of your log.

### Solution

Extract shape-agnostically at one choke point; use it for every failed-run mapping:

```ts
function runErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    let e = error as { message?: unknown }
    if (typeof e.message === 'string') return e.message
    return JSON.stringify(error)
  }
  return String(error)
}
```

```ts
error: result.status === 'failed' ? runErrorMessage(result.error) : 'unknown_error',
```

### When to Use

- An executor (or any `run.start()` consumer) maps failed runs to `error?: string`
- A test asserting a failed run's error text receives `"[object Object]"`
- Admin-facing reports show `[object Object]` after a workflow failure
