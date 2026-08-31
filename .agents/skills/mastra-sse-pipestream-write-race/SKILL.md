---
name: mastra-sse-pipestream-write-race
description: "Use when a Remix/Mastra SSE pipeStream endpoint writes durable state from a suspension or terminal hook and a follow-up read (or reconnect) sees stale pre-write state, or when a test passes in isolation but fails under load with a stale status — make the fire-and-forget hook awaitable and let the stream settle only after the write commits."
metadata:
  origin: auto-extracted
---

# SSE stream closes the body before an async durable write lands

**Extracted:** 2026-08-31
**Context:** Remix 3 + Mastra agent SSE endpoints (`app/utils/agent-sse.ts` `pipeStream`) that fork a durable DB write from a suspension/terminal hook while streaming the SSE body to the client.

## Problem
`pipeStream` calls `closeOnce()` (closing the SSE `ReadableStream` controller) as part of settling a suspension. If a suspension/terminal hook fires a durable write in a **fire-and-forget** `.catch()` promise, the stream body ends and the HTTP response resolves **before** the write commits. Code that reads the durable row right after the stream completes then sees the pre-write state (e.g., a gate still `running` instead of `suspended`), and a reconnect racing the write can surface a stale gate. This is timing-dependent: it passes in isolation and fails under load, so it's easy to misread as a data/logic bug.

## Solution
Make the hook **awaitable** and have the stream-settle path **await it before closing the body**. `pipeStream`'s loop must `await` the hook (so the forwarding function becomes async), and the hook must **return** the write promise — never fire-and-forget it — so the stream settles only after the write lands.

```ts
// hook returns the DB write promise (not a fire-and-forget .catch chain)
onSuspension: (info) =>
  markGateSuspended(user.id, { /* ... */ }).catch((e) => log('write error: ' + String(e))),
```

- **Server side:** return the write promise from the hook; `pipeStream` awaits it *before* `closeOnce()`.
- **Test side:** the test must **fully consume the response body** (e.g., `await parseSSEResponse(response)`) so the stream's `start` callback (including the awaited write) runs to completion before the test reads the durable row.

## When to Use
- A streaming agent endpoint writes durable state (a per-admin gate, a run-owner pointer) from a suspend/terminal hook that runs during stream settle/close.
- A test reads DB state right after `await fetch(...)` and sees a stale value (`running` instead of `suspended`) even though the logic is correct.
- A test passes in isolation but intermittently fails in a full parallel run.
- A reconnect endpoint reads a row that a just-finished stream was expected to update.
