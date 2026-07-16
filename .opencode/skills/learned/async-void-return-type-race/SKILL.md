---
name: async-void-return-type-race
description: "When a function starts async work but returns void, awaiting it resolves immediately before the work completes"
origin: auto-extracted
---

# Async Fire-and-Forget Return Type Race

**Extracted:** 2026-07-15
**Context:** Any utility function that starts an async IIFE internally but returns `void` instead of `Promise<void>`, causing `await fn()` to resolve before the async work finishes.

## Problem

When a function starts async work via an immediately-invoked async function expression (IIFE) but returns `void`, callers that `await` it will resolve immediately — before the async work completes:

```typescript
// ❌ Bug: returns void, so await resolves instantly
function pipeStream(stream, controller, signal) {
  let reader
  ;(async () => {
    reader = stream.getReader()
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      controller.enqueue(value)
    }
    controller.close()
  })()

  return () => reader?.cancel() // cancel function, not a promise
}

// Caller thinks this waits for completion:
await pipeStream(output.fullStream, controller, signal)
// ❌ Resolves immediately — next line fires before stream is consumed
clearTimeout(timeout)  // removes timeout that was meant to protect the stream
logAudit(...)          // records audit before stream errors
```

This manifests as:
- Timeout/cleanup firing before the async work finishes
- Audit logs written before errors occur
- Resources freed while still in use

## Solution

Change the return type to `Promise<void>` and wrap the async IIFE in a `new Promise`:

```typescript
// ✅ Correct: returns Promise<void>, await actually waits
function pipeStream(stream, controller, signal): Promise<void> {
  let reader
  let closed = false

  function closeOnce() {
    if (closed) return
    closed = true
    try { controller.close() } catch { /* already closed */ }
  }

  return new Promise<void>((resolve) => {
    reader = stream.getReader()
    signal.addEventListener('abort', () => {
      reader?.cancel().catch(() => {})
      closeOnce()
      resolve()
    }, { once: true })

    ;(async () => {
      try {
        while (true) {
          let { done, value } = await reader!.read()
          if (done) break
          if (signal.aborted) { closeOnce(); resolve(); return }
          controller.enqueue(value)
        }
        closeOnce()
      } catch (err) {
        // handle error, still resolve to not leave caller hanging
        closeOnce()
      }
      resolve()
    })()
  })
}

// Caller now correctly awaits:
await pipeStream(output.fullStream, controller, signal)
// ✅ This actually waits — next line fires after stream is consumed
clearTimeout(timeout)
logAudit(...)
```

## How to detect this pattern

1. Function contains an async IIFE (`;(async () => { ... })()`)
2. Return type is `void` (or returns a cancel/cleanup function, not a promise)
3. Callers `await` the function
4. Any code after the `await` executes before the IIFE's async work finishes

## Fix checklist

- [ ] Change return type from `void` to `Promise<void>`
- [ ] Wrap the async IIFE body in `new Promise<void>((resolve) => { ... resolve() })`
- [ ] Ensure `resolve()` is called in ALL exit paths: normal completion, error, abort, early return
- [ ] Remove any cancel-function return (or move it inside the promise if still needed)
- [ ] Update ALL call sites — they may need `await` added if they weren't awaiting before

## When to Use

- You write a utility function that internally starts async work (`ReadableStream` consumption, event processing, etc.)
- The function currently returns `void` or returns a cleanup/cancel function
- Callers use `await fn()` expecting to wait for completion
- Specifically: SSE streaming pipes, WebSocket message processors, batch data transformers, any "pump" pattern where data flows through a stream
