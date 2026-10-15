# Materialize a Mastra thread before streaming when an input processor reads memory

**Extracted:** 2026-10-15

## Problem

The support agent's `ToolSearchProcessor({ storage: 'context' })` recalls the
thread's messages during the stream's `prepare-tools` step to derive which
dynamically-loaded tools are still active. Mastra creates the thread lazily while
persisting the first message — *after* prepare-tools — so the recall ran against
a thread that did not exist yet:

```
ERROR (Mastra): Error executing step workflow.execution-workflow.step.prepare-tools-step:
Error: No thread found with id <uuid>
    at Memory.validateThreadIsOwnedByResource (.../@mastra/memory/src/index.ts:741)
    at async Memory.recall (...)
    at async ToolSearchProcessor.getLoadedToolsForRequestContext (...)
```

`Memory.recall` only rejects a missing thread when it is called with a
`resourceId` (`resourceId ? validateThreadIsOwnedByResource(...) : undefined`);
the processor passes one, while the app's own `recallChatMessages` passes
`resource` (a different key) so it never tripped this. Every first turn of a new
support conversation failed; the customer agent was unaffected because it has no
memory-reading input processor. The regression appeared with the `@mastra/core`
1.76 → 1.77 bump (same failure against `@mastra/memory` 1.37.0 and 1.37.1).

## Solution

Before `agent.stream(message, { memory: { thread, resource } })`, materialize
the row with the documented helper and the same ids the stream will use:

```ts
// app/utils/mastra-memory.ts
export async function ensureChatThread(agent: unknown, threadId: string, resourceId: string) {
  // no-op for test doubles without memory
  if (typeof agent !== 'object' || agent === null ||
      typeof (agent as { getMemory?: unknown }).getMemory !== 'function') return
  let memory = await getMemory(agent as AgentHandle)
  if (await memory.getThreadById({ threadId })) return   // preserve createdAt
  await memory.createThread?.({ threadId, resourceId })
}
```

Call it in the support controller's `action` after the thread id is resolved and
before `engine.messageStream(...)`. `memory.createThread` defaults
`title: title || ''` (the `mastra_threads.title` column is `NOT NULL`) and
`saveThread: true`; calling `saveThread` directly with no title fails the
insert. `saveThread`/`createThread` upsert by id, so a second call rewrites
`createdAt` — hence the `getThreadById` guard.

`ensureChatThread` lives in the shared memory module but only the support
controller opts in, because only its processor reads memory.

## Tests

- `app/utils/mastra-memory.test.ts` (`describe('ensureChatThread')`) runs the
  real Mastra Postgres memory: `memory.recall({ threadId, resourceId })` rejects
  with `/No thread found/` before, succeeds after `createThread`, and a second
  `ensureChatThread` leaves `createdAt` intact.
- `app/actions/support-agent/controller.test.ts` guards the wiring: a mock agent
  that exposes `getMemory().createThread` records the created thread, and the
  test asserts it is the same id passed to `stream`'s `memory.thread`.

## When to Use

- A new conversation's first turn fails with `No thread found with id <id>`, or
  any `Memory.recall` with a `resourceId` runs before the first message is
  saved.
- Adding a memory-reading input processor to an agent whose thread is created
  lazily (the conversation surface must opt into materializing the thread).
