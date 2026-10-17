# Actor Identity via RequestContext

## What This Covers

How a Mastra tool reads the authenticated user/admin id for the current run.
Read this when:

- A tool needs the current user id, email, tenant, or other session data the LLM cannot know
- You see `requireAdminId` / `runWithUserId` / `AsyncLocalStorage` in old code, or a tool throws "Not authenticated"
- TypeScript reports `TS2322` assigning a `RequestContext<...>` to a run option
- A tool works on the first turn but fails after an `ask_user` answer or an approval

## The Pattern

`app/actions/mastra/actor-context.ts` is the single source:

```typescript
import { RequestContext } from '@mastra/core/request-context'

interface RequestContextReader {
  getRaw(key: string): unknown
}

export function createActorRequestContext(actorId: number): RequestContext {
  let requestContext = new RequestContext()
  requestContext.set('actorId', actorId)
  return requestContext
}

export function requireActorId(requestContext: RequestContextReader | undefined): number {
  let actorId = requestContext?.getRaw('actorId')
  if (typeof actorId !== 'number') {
    throw new Error('Not authenticated: missing actorId in request context')
  }
  return actorId
}
```

Tool:

```typescript
execute: async ({ appointmentId }, { requestContext }) => {
  let actorId = requireActorId(requestContext)
  // ...
}
```

Pass it at every run entry point:

```typescript
await agent.stream(message, { memory, requestContext: createActorRequestContext(actorId) })
await agent.resumeStream(resumeData, { runId, toolCallId, requestContext: createActorRequestContext(actorId) })
await agent.approveToolCallGenerate({ runId, toolCallId, requestContext: createActorRequestContext(actorId) })
```

## Version-Pinned Gotchas (@mastra/core 1.72.0)

1. **`requestContext` is the second `execute` argument and is non-optional.**
   `ToolExecutionContext.requestContext` is non-optional in `dist/tools/types.d.ts`;
   the runtime creates an empty context if the caller passed none.
2. **`RequestContext<Values>` is invariant — do not type it.** The run option is
   `AgentExecutionOptionsBase.requestContext?: RequestContext<any>`. A
   `RequestContext<{ actorId: number }>` is not assignable to it and fails
   `TS2322` ("Type 'unknown' is not assignable to type 'ActorRequestContext'").
   Build an untyped `RequestContext` and validate in the reader. Type the reader
   structurally (`{ getRaw(key: string): unknown }`) so it accepts any
   `RequestContext<Values>`; `@typescript-eslint/no-explicit-any` is error-level
   here, so a `RequestContext<any>` field needs an inline disable.
3. **Typed and raw maps share one registry.** `set()`/`get()` and `setRaw()`/`getRaw()`
   read/write the same store (runtime-verified), so `getRaw('actorId')` reads a value
   written with the typed `set('actorId', id)`.
4. **The context survives suspension.** Mastra forwards `requestContext` through
   `stream`, `resumeStream`, and `approveToolCallGenerate`/`declineToolCallGenerate`.
   On resume it merges the persisted snapshot context into the caller's, caller
   values winning (`if (!requestContextToUse.has(key))`). Verified by tracing the
   bundled core — the mock-agent controller tests cannot prove this path.

## Why Not AsyncLocalStorage

`AsyncLocalStorage` scopes to a Node async context, not to a run. It does not
cross the workflow, PubSub, background-task, or subagent boundaries durable
execution introduces, and it loses the actor when a run is resumed from a
persisted snapshot. This app retired it: `app/utils/async-storage.ts` and
`app/actions/mastra/tools/admin-context.ts` were deleted in favour of
`actor-context.ts`.
