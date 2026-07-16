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

## When to Use

- You have a Mastra agent with at least one destructive tool
- You want a hard (non-bypassable) approval gate, not just LLM-instruction soft gating
- Your agent calls use `agent.generate()` and you want to avoid refactoring to `stream()`
- Calling `approveToolCallGenerate`/`declineToolCallGenerate` through a variable reference

## Related Skills

- `mastra-agent-streaming-sse` — streaming SSE pattern with askUserTool (streaming alternative)
- `mastra-agent-suspend-payload-tool-detection` — detecting which tool caused suspension from payload shape
