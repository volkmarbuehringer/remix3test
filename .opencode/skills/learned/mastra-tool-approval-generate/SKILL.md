---
name: mastra-tool-approval-generate
description: 'Hard-gate destructive Mastra tools via requireApproval + approveToolCallGenerate, including the detached this-binding gotcha'
origin: consolidated
---

# Mastra Tool Approval with `generate()` (Non-Streaming)

**Consolidated from:** `mastra-tool-approval-generate-pattern`, `mastra-detached-method-this-binding`

Covers the non-streaming tool approval flow:
1. Hard-gating destructive tools with `requireApproval: true` + `generate()`
2. Common pitfall: detached `this` binding when calling `approveToolCallGenerate`/`declineToolCallGenerate`

---

## Part 1: Hard-Gating Tools with generate()

### Problem

You have a Mastra agent with a destructive tool (delete user, cancel account, etc.). You want a hard approval gate — the tool must NOT execute unless an admin explicitly confirms via a button in the UI. Your controller uses `agent.generate()` (not `stream()`), and you don't want to refactor to streaming.

### Solution

#### 1. Add `requireApproval: true` to the tool definition

```typescript
const destructiveTool = createTool({
  id: 'delete_record',
  description: 'Delete a record by ID.',
  requireApproval: true,
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }) => {
    await db.delete(id)
    return { deleted: true }
  },
})
```

#### 2. Call `generate()` WITHOUT `requireToolApproval`

```typescript
let result = await agent.generate(message, {
  maxSteps: 10,
  memory: { thread: threadId, resource: String(userId) },
  // ⚠️ Do NOT pass requireToolApproval: true here
  //    That makes ALL tool calls require approval, not just the gated one
})
```

`requireToolApproval: true` on `generate()` overrides and suspends **every** tool call regardless of the tool's individual `requireApproval` setting. Without it, only tools with `requireApproval: true` suspend.

#### 3. Detect suspension and store state

```typescript
if (result.finishReason === 'suspended') {
  let suspendPayload = result.suspendPayload as { toolCallId?: string } | undefined
  let toolCallId = suspendPayload?.toolCallId

  session.flash('toolApproval', {
    runId: result.runId,
    toolCallId,
    responseText: result.text,
  })

  return redirect('/chat?pending=true')
}
```

#### 4. Resume on approval/decline — use the GENERATE variants

```typescript
// ✅ CORRECT — generate variants
await agent.approveToolCallGenerate({ runId, toolCallId })
await agent.declineToolCallGenerate({ runId, toolCallId })

// ❌ WRONG — these are for stream()-suspended runs, not generate()-suspended
await agent.approveToolCall({ runId })
await agent.declineToolCall({ runId })
```

Both `approveToolCallGenerate` and `declineToolCallGenerate` return `FullOutput` with `.text`, matching the `generate()` calling pattern.

#### 5. Preserve AsyncLocalStorage context on resume

If the tool's `execute` function reads from `AsyncLocalStorage` (e.g., `requireAdminId()`), the resume call must wrap in that same context:

```typescript
let result = await runWithAdminId(user.id, () =>
  agent.approveToolCallGenerate({ runId, toolCallId }),
)
```

#### 6. UI approval card (server-rendered)

```
┌──────────────────────────────────────────────┐
│  Benutzerkonto löschen?                      │
│  Soll Benutzer foo (ID 5) gelöscht werden?   │
│                                              │
│  [✔ Bestätigen]  [✖ Ablehnen]               │
└──────────────────────────────────────────────┘

<form method="POST" action="/chat/approve">
  <input type="hidden" name="runId" value="..." />
  <input type="hidden" name="toolCallId" value="..." />
  <input type="hidden" name="_csrf" value="..." />
  <button type="submit">✔ Bestätigen</button>
</form>
```

The `_csrf` token is critical — server-rendered POST forms still need CSRF protection on the approval endpoints.

---

## Part 2: Detached `this` Binding on approve/decline

### Problem

When you extract a Mastra agent method into a variable before calling it, JavaScript's `this` binding is lost. The method executes with `this === undefined`, so internal calls like `this.resumeGenerate()` fail:

```typescript
// ❌ BROKEN — extracting the method detaches `this`
let fn = agent.approveToolCallGenerate
let result = await fn({ runId, toolCallId })
// TypeError: Cannot read properties of undefined (reading 'resumeGenerate')
```

This affects both approve and decline methods:

```typescript
let fn = decision === 'approve'
  ? agent.approveToolCallGenerate
  : agent.declineToolCallGenerate
fn({ runId, toolCallId }) // ❌ this.resumeGenerate crashes
```

### Solution

Call the method directly on the agent object so `this` stays bound:

```typescript
// ✅ CORRECT — call method directly on the agent
let result = decision === 'approve'
  ? await agent.approveToolCallGenerate({ runId, toolCallId })
  : await agent.declineToolCallGenerate({ runId, toolCallId })
```

Or use `.call()` to explicitly bind `this`:

```typescript
let fn = agent.approveToolCallGenerate
let result = await fn.call(agent, { runId, toolCallId })
```

### Detection

Suspect this issue when:
- `agent.approveToolCallGenerate` or `agent.declineToolCallGenerate` throws `Cannot read properties of undefined (reading 'resumeGenerate')`
- The same tool approval works in one code path but fails in another that stores the method in a variable
- The call uses the pattern `let fn = agent.methodName; fn(args)` instead of `agent.methodName(args)`

### Why This Happens

JavaScript methods extracted as property values lose their receiver (the `this` value):

```typescript
let obj = { name: 'test', greet() { return this.name } }
let fn = obj.greet
fn() // undefined — not 'test'
```

---

## Part 3: Sequential Tool Approval Chaining (Multiple `requireApproval` Tools)

### Problem

When the agent needs to call multiple `requireApproval` tools in sequence (e.g. lock two users), each tool call suspends. After approving the first tool via `approveToolCallGenerate`, the agent continues and immediately calls the second tool, which suspends again. The `approveToolCallGenerate` result has `finishReason: 'suspended'` but the `suspendPayload` contains `toolCallId`/`toolName`/`args` (**not** `question` — that's only for `askUserTool`). If the SSE response doesn't forward this suspension to the client, the second approval is silently lost.

Additionally, `approveToolCallGenerate` returns a `FullOutput` (not a stream). It has **no** `runId` or `fullStream` properties. The client needs a `start` SSE event with the `runId` to re-establish its `currentRunId` — otherwise subsequent `handleToolDecision()` calls silently return because `currentRunId` is null.

### Solution

In the tool-decision SSE handler:

1. Send an `event: start` with `runId` at the beginning of the response stream
2. When `finishReason === 'suspended'`, check the `suspendPayload` for either:
   - `sp?.question` → this is an `askUserTool` question → emit `event: question`
   - `sp?.toolCallId || sp?.toolName` → this is a `requireApproval` suspension → emit `event: suspension` with `toolCallId`, `toolName`, `args`

```typescript
async function handleToolDecision(request, reply) {
  let body = new ReadableStream({
    start: async (controller) => {
      // 1. Send start event FIRST so client re-establishes currentRunId
      controller.enqueue(
        sseEncoder.encode(
          `event: start\ndata: ${JSON.stringify({ runId, threadId })}\n\n`,
        ),
      )

      let result = await agent.approveToolCallGenerate({ runId, toolCallId })

      // 2. Check for suspension (askUserTool vs requireApproval)
      if (result.finishReason === 'suspended') {
        let sp = result.suspendPayload as
          | { question?: string; toolCallId?: string; toolName?: string; args?: Record<string, unknown> }
          | undefined

        // askUserTool suspension — has .question
        if (sp?.question) {
          controller.enqueue(
            sseEncoder.encode(`event: question\ndata: ${JSON.stringify({
              runId, toolCallId: sp.toolCallId,
              question: sp.question,
              options: sp.options ?? null,
            })}\n\n`),
          )
          controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
          controller.close()
          return
        }

        // requireApproval suspension — has .toolCallId / .toolName
        if (sp?.toolCallId || sp?.toolName) {
          controller.enqueue(
            sseEncoder.encode(`event: suspension\ndata: ${JSON.stringify({
              runId,
              toolCallId: sp.toolCallId,
              toolName: sp.toolName,
              args: sp.args,
            })}\n\n`),
          )
          controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
          controller.close()
          return
        }
      }

      // 3. Text response — no further suspension
      let text = (result.text || '').trim()
      if (text) {
        controller.enqueue(
          sseEncoder.encode(`event: message\ndata: ${JSON.stringify({ text })}\n\n`),
        )
      }
      controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
      controller.close()
    },
  })

  return new Response(body, { headers: sseHeaders() })
}
```

### Client-side flow

The client's SSE handler already processes `event: suspension` by showing an approve/decline UI and canceling the reader. Since the `start` event re-sets `currentRunId`, the second `handleToolDecision()` call will pass the `if (!currentRunId) return` guard.

```
Initial stream:
  event: start → currentRunId = "run-1"
  event: suspension → show approve button, cancel reader
  (user clicks approve)

Tool-decision stream:
  event: start → currentRunId = "run-1" (re-set)
  event: suspension → show approve button, cancel reader
  (user clicks approve — works because currentRunId is set)

Tool-decision stream:
  event: start → currentRunId = "run-1"
  event: message → "Both users locked"
  event: complete → done
```

### Key points

- `approveToolCallGenerate` returns `FullOutput` — it has **no** `fullStream` or `runId` properties at the TypeScript level. The `runId` must be extracted from the original request or cast from the runtime result.
- Always send `event: start` before handling the result. Without it, the client's `currentRunId` stays null from the previous `complete` handler, and subsequent `handleToolDecision()` calls silently no-op.
- The `requireApproval` suspension payload contains `toolCallId`, `toolName`, `args` — NOT `question`. Don't check for `sp?.question` for requireApproval tools.
- The client-side reader cancellation after `event: suspension` (line `reader.cancel().catch(() => {}); return;`) is correct — it stops the current SSE stream so the next user action creates a new stream.

---

## When to Use

- You have a Mastra agent with at least one destructive tool
- You want a hard (non-bypassable) approval gate, not just LLM-instruction soft gating
- Your agent calls use `agent.generate()` and you want to avoid refactoring to `stream()`
- Calling `approveToolCallGenerate`/`declineToolCallGenerate` through a variable reference
- The agent may call multiple `requireApproval` tools in a single run (sequential tool chaining)

## Related Skills

- `mastra-agent-streaming-sse` — streaming SSE pattern with askUserTool (streaming alternative)
- `mastra-tool-suspension-detection` — detecting which tool caused suspension from payload shape
- `mastra-agent-streaming-sse` Part 3 — `requireToolApproval` snapshot loss pattern (applies to both stream and generate flows on resume)
