# Approval Gating

## What This Covers

Hard-gating destructive tools with `agent.generate()` and handling suspensions. Read this when the task involves:

- A hard approval gate on a destructive tool without refactoring to `stream()`
- `approveToolCallGenerate`/`declineToolCallGenerate` throwing `resumeGenerate` errors
- Multiple `requireApproval` tools chaining in one run
- Multiple approval tools needing different UI cards, where the payload lacks the tool name

For the base approval API (`requireApproval: true`, `finishReason: 'suspended'`, `suspendPayload`, `requireToolApproval`), see `node_modules/@mastra/core/dist/docs/references/docs-agents-agent-approval.md`. For tool design (single-job, self-lookup, pagination), see `tool-design.md`.

## Hard-Gating Tools with `generate()` (Non-Streaming)

You have a Mastra agent with a destructive tool (delete user, cancel account, etc.) and want a hard approval gate — the tool must NOT execute unless an admin explicitly confirms via a button in the UI. Your controller uses `agent.generate()` (not `stream()`), and you don't want to refactor to streaming.

The base approval API lives in the authoritative Mastra doc (link above); the deltas below are the hard-won nuances it doesn't cover.

### Detached `this` Binding on approve/decline

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

Suspect this issue when `approveToolCallGenerate`/`declineToolCallGenerate` throws `Cannot read properties of undefined (reading 'resumeGenerate')`, the same approval works in one path but fails in another that stores the method in a variable, or the call uses `let fn = agent.methodName; fn(args)` instead of `agent.methodName(args)`.

### Sequential Tool Approval Chaining (Multiple `requireApproval` Tools)

When the agent needs to call multiple `requireApproval` tools in sequence (e.g. lock two users), each tool call suspends. After approving the first tool via `approveToolCallGenerate`, the agent continues and immediately calls the second tool, which suspends again. The `approveToolCallGenerate` result has `finishReason: 'suspended'` but the `suspendPayload` contains `toolCallId`/`toolName`/`args` (**not** `question` — that's only for `askUserTool`). If the SSE response doesn't forward this suspension to the client, the second approval is silently lost.

Additionally, `approveToolCallGenerate` returns a `FullOutput` (not a stream). It has **no** `runId` or `fullStream` properties. The client needs a `start` SSE event with the `runId` to re-establish its `currentRunId` — otherwise subsequent `handleToolDecision()` calls silently return because `currentRunId` is null.

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

Client-side flow:

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

Key points:

- `approveToolCallGenerate` returns `FullOutput` — it has **no** `fullStream` or `runId` at the TypeScript level. The `runId` must be extracted from the original request or cast from the runtime result.
- Always send `event: start` before handling the result. Without it, the client's `currentRunId` stays null from the previous `complete` handler, and subsequent `handleToolDecision()` calls silently no-op.
- The `requireApproval` suspension payload contains `toolCallId`, `toolName`, `args` — NOT `question`. Don't check for `sp?.question` for requireApproval tools.
- The client-side reader cancellation after `event: suspension` is correct — it stops the current SSE stream so the next user action creates a new stream.

## Suspension Tool Detection

When a Mastra agent suspends execution (because a tool has `requireApproval: true`), the agent's `generate()` returns `finishReason: 'suspended'` with a `suspendPayload` that contains the tool args and `toolCallId` — but **not the tool name or ID**. If multiple tools have `requireApproval`, the controller can't directly know which tool caused the suspension, making it impossible to render different approval UIs for different tools.

For example, both `confirmResource` (shows resource details) and `cancelBooking` (shows appointment summary with danger styling) require approval, but need completely different UI cards.

Infer the tool name from the shape of the `suspendPayload.args` — each tool has a unique set of parameter names:

```typescript
type ApprovalData = {
  type: 'resource' | 'cancel_single' | 'cancel_all'
  resourceName?: string
  resourceDescription?: string
  cancelSummary?: string
  cancelCount?: number
  cancelSummaries?: string[]
}

function extractApprovalData(suspendPayload: unknown): ApprovalData {
  let sp = suspendPayload as { args?: Record<string, unknown> } | undefined
  let args = sp?.args ?? {}

  // cancel_booking has appointmentSummary
  if ('appointmentSummary' in args) {
    return {
      type: 'cancel_single',
      cancelSummary: String(args.appointmentSummary ?? ''),
    }
  }
  // cancel_all_appointments has count/appointmentSummaries
  if ('count' in args || 'appointmentSummaries' in args) {
    return {
      type: 'cancel_all',
      cancelCount: Number(args.count ?? 0),
      cancelSummaries: (args.appointmentSummaries as string[]) ?? [],
    }
  }
  // confirm_resource has resourceName/description
  return {
    type: 'resource',
    resourceName: String(args.resourceName ?? ''),
    resourceDescription: String(args.description ?? ''),
  }
}
```

Usage in the controller:

```typescript
if (result.finishReason === 'suspended') {
  let approval = extractApprovalData(result.suspendPayload)
  session.flash('toolApproval', {
    runId: result.runId,
    toolCallId: suspendPayload.toolCallId,
    ...approval,  // type + tool-specific display fields
  })
  // UI reads approvalData.type to render the correct card
}
```

Limitations:

- Fragile if future tools share field names — consider adding a `_approvalType` field to tool args as a more robust alternative
- Only works if each tool has a unique set of required parameter names
