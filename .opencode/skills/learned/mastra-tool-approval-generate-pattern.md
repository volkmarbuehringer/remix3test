---
name: mastra-tool-approval-generate-pattern
description: 'Hard-gate destructive Mastra tools via requireApproval + approveToolCallGenerate without switching to streaming'
origin: auto-extracted
---

# Mastra Tool Approval with `generate()` (Non-Streaming)

**Extracted:** 2026-07-10
**Context:** Adding a hard approval gate to a destructive Mastra tool (`cancel_user_account`) while keeping the existing `agent.generate()` caller — no streaming refactor needed.

## Problem

You have a Mastra agent with a destructive tool (delete user, cancel account, etc.). You want a hard approval gate — the tool must NOT execute unless an admin explicitly confirms via a button in the UI. However:

- Your controller uses `agent.generate()` (not `stream()`), and you don't want to refactor to streaming
- Setting `requireApproval: true` on the tool alone may not work without the right generate options
- Passing `requireToolApproval: true` to `generate()` suspends **every** tool call (including harmless read-only ones)
- Using the stream variant of approve/decline (`approveToolCall`/`declineToolCall`) with a generate-suspended run hangs or returns empty text

## Solution

### 1. Add `requireApproval: true` to the tool definition

```typescript
const destructiveTool = createTool({
  id: 'delete_record',
  description: 'Delete a record by ID.',
  requireApproval: true, // ← THIS is all you need
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }) => {
    // tool never runs without explicit approval
    await db.delete(id)
    return { deleted: true }
  },
})
```

### 2. Call `generate()` WITHOUT `requireToolApproval`

```typescript
let result = await agent.generate(message, {
  maxSteps: 10,
  memory: { thread: threadId, resource: String(userId) },
  // ⚠️ Do NOT pass requireToolApproval: true here
  //    That makes ALL tool calls require approval, not just the gated one
})
```

`requireToolApproval: true` on `generate()` overrides and suspends **every** tool call regardless of the tool's individual `requireApproval` setting. Without it, only tools with `requireApproval: true` suspend.

### 3. Detect suspension and store state

```typescript
if (result.finishReason === 'suspended') {
  let suspendPayload = result.suspendPayload as { toolCallId?: string } | undefined
  let toolCallId = suspendPayload?.toolCallId

  // Store in session flash (survives one redirect)
  session.flash('toolApproval', {
    runId: result.runId,
    toolCallId,
    responseText: result.text,
  })

  // Redirect to page that renders approval buttons
  return redirect('/chat?pending=true')
}
```

### 4. Resume on approval/decline — use the GENERATE variants

When the admin clicks Approve or Decline:

```typescript
// ✅ CORRECT — generate variants
await agent.approveToolCallGenerate({ runId, toolCallId })
await agent.declineToolCallGenerate({ runId, toolCallId })

// ❌ WRONG — these are for stream()-suspended runs, not generate()-suspended
await agent.approveToolCall({ runId }) // returns MastraModelOutput (stream)
await agent.declineToolCall({ runId }) // returns MastraModelOutput (stream)
```

Both `approveToolCallGenerate` and `declineToolCallGenerate` return `FullOutput` with `.text`, matching the `generate()` calling pattern.

### 5. Preserve AsyncLocalStorage context on resume

If the tool's `execute` function reads from `AsyncLocalStorage` (e.g., `requireAdminId()`), the resume call must wrap the approval in that same context:

```typescript
let result = await runWithAdminId(user.id, () =>
  agent.approveToolCallGenerate({ runId, toolCallId }),
)
```

Without this, the resumed tool execution will fail because the async context wasn't restored.

### 6. UI approval card pattern (server-rendered)

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
  <input type="hidden" name="_csrf" value="..." />  ← required!
  <button type="submit">✔ Bestätigen</button>
</form>
```

The `_csrf` token is critical — server-rendered POST forms in Mastra-powered apps still need CSRF protection on the approval endpoints.

## When to Use

- You have a Mastra agent with at least one destructive tool
- You want a hard (non-bypassable) approval gate, not just LLM-instruction soft gating
- Your agent calls use `agent.generate()` and you want to avoid refactoring to `stream()`
- The destructive tool is the minority — most tools are read-only and should not require approval

## Key Insights

| Concept               | Correct                                                        |
| --------------------- | -------------------------------------------------------------- |
| Tool gating           | `requireApproval: true` on `createTool` — sufficient by itself |
| Generate option       | Omit `requireToolApproval` — let tool-level setting control    |
| Resume stream-variant | `approveToolCallGenerate` / `declineToolCallGenerate`          |
| Run ID                | From `result.runId`                                            |
| Tool call ID          | From `result.suspendPayload.toolCallId`                        |
| Async context         | Restore before calling resume (if tool reads ALS)              |
| Abort timeout         | Skip/suspend the abort timer while waiting for approval        |
