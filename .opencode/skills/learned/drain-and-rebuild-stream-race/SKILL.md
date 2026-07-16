---
name: drain-and-rebuild-stream-race
description: "When a library internally consumes a ReadableStream before your code stores it, drain the stream into a buffer and rebuild a new stream"
origin: auto-extracted
---

# ReadableStream Race Resolution via Drain-and-Rebuild

**Extracted:** 2026-07-12
**Context:** Any framework or library where a ReadableStream getter returns a new stream wrapping a shared `baseStream`, and internal code (broadcast, logging, etc.) races your code to consume it first.

## Problem

When a library exposes a `fullStream` getter (or similar) that creates a new `ReadableStream` via `source.pipeThrough(new TransformStream())` each time it's accessed, the underlying `source` stream can only be consumed once. If the library's internal logic also reads from the same getter (e.g., a broadcast or subscriber mechanism), a race condition occurs:

```
Library internal:  startBroadcast() → output.fullStream → locks baseStream  [async .then()]
Your code:         setStream(runId, { fullStream: output.fullStream })       [synchronous]
```

The winner locks `baseStream`; the loser gets an empty/broken stream. When your code loses, the stored stream produces negligible data (~2 bytes of SSE), and the client receives no events.

## Solution

Drain the stream into an in-memory array **immediately** (synchronously after the async call returns, before the library's microtask runs), then create a fresh `ReadableStream` from the buffer:

```typescript
async function drainAndRebuild(stream: unknown): Promise<ReadableStream<unknown>> {
  let parts: unknown[] = []
  let reader = (stream as ReadableStream<unknown>).getReader()
  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return new ReadableStream({
    start(controller) {
      for (let part of parts) {
        controller.enqueue(part)
      }
      controller.close()
    },
  })
}
```

Usage:

```typescript
// Before (race-prone):
setStream(output.runId, {
  fullStream: output.fullStream, // library may have already consumed this
})

// After (race-free):
let buffered = await drainAndRebuild(output.fullStream)
setStream(output.runId, {
  fullStream: buffered,
})
```

### How it works

1. `getReader()` locks and starts reading the stream
2. `await reader.read()` pulls all chunks into an array
3. `finally { reader.releaseLock() }` ensures cleanup even on error
4. A new `ReadableStream` is created that enqueues the buffered parts in order, then closes

The buffer holds all stream events in memory until the downstream consumer drains it. For typical agent/LLM responses (<100KB), this is negligible. For long streams (e.g., streaming audio), consider alternative approaches.

## Trade-offs

| Aspect | Before (direct fullStream) | After (drainAndRebuild) |
|--------|---------------------------|-------------------------|
| Streaming latency | Real-time (events piped as they arrive) | Batched (all events delivered at once after buffer completes) |
| Memory | Minimal (pass-through) | O(stream size) until downstream reads |
| Race safety | Fragile (depends on microtask timing) | Deterministic (buffer wins every time) |

## When to Use

- A third-party library exposes a `ReadableStream` getter that wraps a shared `baseStream`
- You store the stream for later consumption, and the library internally consumes the same getter
- The stored stream intermittently produces empty/no data (~2 bytes)
- The library's internal consumer runs asynchronously (Promise.then, microtask) while your code is synchronous
- You can tolerate a small delay (buffer time) in exchange for deterministic stream delivery

## Variants

### Error handling during drain
If individual stream errors should be preserved rather than crashing the buffer:

```typescript
async function drainAndRebuild(stream: unknown): Promise<ReadableStream<unknown>> {
  let parts: unknown[] = []
  let reader = (stream as ReadableStream<unknown>).getReader()
  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }
  } catch (err) {
    // Preserve the error by creating a stream that errors
    return new ReadableStream({
      start(controller) {
        controller.error(err)
      },
    })
  } finally {
    reader.releaseLock()
  }
  return new ReadableStream({
    start(controller) {
      for (let part of parts) controller.enqueue(part)
      controller.close()
    },
  })
}
```

### Tee alternative
If your runtime supports it, `stream.tee()` creates two independent branches without buffering:

```typescript
let [branch1, branch2] = output.fullStream.tee()
// Use branch1 for the library, branch2 for your code
```

`tee()` avoids the buffer latency trade-off but pushes memory cost to the branch that is consumed later. Not all `ReadableStream` implementations support `tee()` (notably some `node:stream/web` polyfills).
