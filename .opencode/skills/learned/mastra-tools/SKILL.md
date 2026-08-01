---
name: mastra-tools
description: 'Mastra tool design and approval gating — hard-gating with requireApproval, suspension detection, and single-job / self-lookup / offset-pagination tool patterns'
origin: consolidated
---

# Mastra Tools Patterns

**Consolidated from:** `mastra-tool-approval-generate`, `mastra-tool-suspension-detection`, `mastra-tool-offset-pagination`, `mastra-tool-param-self-lookup`, `mastra-tool-single-job-separation`

Covers five aspects of Mastra tools:
1. Hard-gating destructive tools with `requireApproval` + `generate()`
2. Detecting which tool caused a suspension from the suspend payload shape
3. Designing tools with one job each (lookup / confirm / execute separation)
4. Looking up context parameters internally instead of asking the LLM
5. Adding offset pagination for "show more" agent requests

---

## Part 1: Hard-Gating Tools with `generate()` (Non-Streaming)

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
<form method="POST" action="/chat/approve">
  <input type="hidden" name="runId" value="..." />
  <input type="hidden" name="toolCallId" value="..." />
  <input type="hidden" name="_csrf" value="..." />
  <button type="submit">✔ Bestätigen</button>
</form>
```

The `_csrf` token is critical — server-rendered POST forms still need CSRF protection on the approval endpoints.

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

Suspect this issue when:
- `agent.approveToolCallGenerate` or `agent.declineToolCallGenerate` throws `Cannot read properties of undefined (reading 'resumeGenerate')`
- The same tool approval works in one code path but fails in another that stores the method in a variable
- The call uses the pattern `let fn = agent.methodName; fn(args)` instead of `agent.methodName(args)`

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
- `approveToolCallGenerate` returns `FullOutput` — it has **no** `fullStream` or `runId` properties at the TypeScript level. The `runId` must be extracted from the original request or cast from the runtime result.
- Always send `event: start` before handling the result. Without it, the client's `currentRunId` stays null from the previous `complete` handler, and subsequent `handleToolDecision()` calls silently no-op.
- The `requireApproval` suspension payload contains `toolCallId`, `toolName`, `args` — NOT `question`. Don't check for `sp?.question` for requireApproval tools.
- The client-side reader cancellation after `event: suspension` (line `reader.cancel().catch(() => {}); return;`) is correct — it stops the current SSE stream so the next user action creates a new stream.

---

## Part 2: Suspension Tool Detection

### Problem

When a Mastra agent suspends execution (because a tool has `requireApproval: true`), the agent's `generate()` returns `finishReason: 'suspended'` with a `suspendPayload` that contains the tool args and `toolCallId` — but **not the tool name or ID**. If multiple tools have `requireApproval`, the controller can't directly know which tool caused the suspension, making it impossible to render different approval UIs for different tools.

For example, both `confirmResource` (shows resource details) and `cancelBooking` (shows appointment summary with danger styling) require approval, but need completely different UI cards.

### Solution

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

---

## Part 3: Single-Job Separation

### Problem

When a multi-step agentic action needs information gathering + human confirmation + execution, it's tempting to use a single tool with a state flag:

```typescript
// ❌ Two-phase tool with confirmed flag
const cancelUser = createTool({
  id: 'cancel_user_workflow_v2',
  inputSchema: z.object({
    targetUserId: z.number(),
    confirmed: z.boolean().optional().default(false),
    deleteAppointments: z.boolean().optional().default(true),
  }),
  execute: async ({ targetUserId, confirmed, deleteAppointments }) => {
    if (!confirmed) {
      let preflight = await runPreflight(targetUserId)
      return { found: true, user: preflight.user, navigate: { path } }
    }
    let result = await executeCancel(targetUserId, deleteAppointments)
    return { success: true, deletedAppointments: result.deleted }
  },
})
```

This creates three problems:

1. **The tool is a state machine** — `execute()` branches on `confirmed`, returning completely different shapes depending on the phase. Hard to test, hard to reason about.
2. **Conversation burden on the agent** — The agent must carry `confirmed=true` across tool calls in working memory. The instructions must say "NEVER ask the admin for the user ID again — you already have it" because the flow is fragile.
3. **Navigation happens after lookup** — The user only sees the grid *after* the tool already found the match. The lookup and the visual verification are decoupled, which causes the **"found but ask for ID" anti-pattern**: the agent finds the user, but instead of letting the user confirm visually, it asks for a technical identifier.

### Solution

Give each phase its own tool. Each tool has exactly one job and one return shape:

```typescript
// ✅ Phase 1: Lookup — read-only, no side effects, no approval needed
const lookupUser = createTool({
  id: 'lookup_user',
  description: 'Look up a user by name, email, or ID. Read-only — no action is taken.',
  requireApproval: false,
  inputSchema: z.object({
    query: z.string().describe('Name, email, or ID'),
  }),
  execute: async ({ query }) => {
    let users = await searchUsers(query)
    let consistency = await runConsistencyCheck()
    return { found: true, users, lockedUsers: consistency.lockedUsers, activeUsers: consistency.activeUsers }
  },
})

// ✅ Phase 2: Navigate (if using frames) — show context to user
//   → separate navigate tool, not baked into lookup or execute

// ✅ Phase 3: Confirmation gate — ask_user (built-in Mastra tool)
//   → ask_user({ question: "Execute?", options: [Bestätigen, Abbrechen] })

// ✅ Phase 4: Execute — single-purpose, always executes
const cancelUser = createTool({
  id: 'cancel_user',
  description: 'Cancel a user account. Call this after lookup + confirmation.',
  inputSchema: z.object({
    targetUserId: z.number(),
    deleteAppointments: z.boolean(),   // required — no default means explicit decision
  }),
  execute: async ({ targetUserId, deleteAppointments }) => {
    return await executeCancel(targetUserId, deleteAppointments)
  },
})
```

The agent protocol becomes a simple linear flow — three phases, one human gate:

```
lookup_user({ query })     → read-only info gathering
navigate({ path })         → show user the context
ask_user("Bereit?")        → human confirmation pause
cancel_user({ targetId })  → always execution
```

Each tool is independently testable, has one return type, and needs no state flag.

---

## Part 4: Parameter Self-Lookup

### Problem

A Mastra agent tool has an `inputSchema` defining what parameters the LLM must provide. If the schema includes fields like `adminName` or `adminEmail`, the LLM must:

1. Know these values (it usually doesn't — they're session/context data, not conversation data)
2. Pass them when calling the tool

The result is one of three failure modes:

- **LLM asks the user**: "What is your name and email?" — terrible UX, makes the tool feel broken
- **LLM confabulates**: generates fake values and calls the tool with wrong data
- **LLM skips the tool**: mentions "PDF report was generated" in text without ever calling the underlying tool, because it lacks the required parameters

### Solution

Look up context-dependent data inside the tool's `execute` function instead of requiring it as an input parameter. Use a module-level context provider (e.g., `AsyncLocalStorage`, `requireAdminId()`) to access the current request/session context.

```typescript
// ❌ BAD: Forces the LLM to provide admin info it doesn't know
const myTool = createTool({
  id: 'my_tool',
  inputSchema: z.object({
    adminName: z.string().describe('Name of the admin'),
    adminEmail: z.string().describe('Email of the admin'),
    targetUserId: z.number().describe('The target user ID'),
  }),
  execute: async ({ adminName, adminEmail, targetUserId }) => {
    // LLM might ask user, confabulate, or skip calling
  },
})

// ✅ GOOD: Tool looks up admin info internally
const myTool = createTool({
  id: 'my_tool',
  inputSchema: z.object({
    targetUserId: z.number().describe('The target user ID'),
  }),
  execute: async ({ targetUserId }) => {
    let adminUserId = requireAdminId()
    let admin = await db.query('SELECT name, email FROM users WHERE id = $1', [adminUserId])
    // admin info available without requiring LLM to pass it
  },
})
```

### When to apply this pattern

Any parameter that can be derived from the current execution context should be looked up internally:

| Parameter | Lookup strategy |
|-----------|----------------|
| Current admin/user ID | AsyncLocalStorage / context provider (`requireAdminId()`) |
| Current admin email | Query DB using admin ID |
| Request IP | Request context headers |
| Session/tenant ID | Request-scoped context |
| Timestamp | `new Date()` inside `execute` |

### What to leave as input parameters

Only parameters that the LLM learns through conversation or reasoning should be input parameters:

- Target user ID (the LLM discovers this through a previous search/lookup tool)
- Action type (cancel/lock/unlock — decided by the LLM based on user request)
- Boolean flags (confirmed, deleteAppointments — determined through ask_user interaction)
- Counts from previous tool results (deletedCount, lockedUsersCount — passed from one tool result to another)

---

## Part 5: Offset Pagination for Agent "Show More" Requests

### Problem

When a Mastra agent tool returns a limited set of results (e.g., top 10 items, next 3 days of slots), the agent cannot request additional results without getting duplicates. Simply calling the tool again with the same parameters returns the same data. The agent has no way to say "give me the next page" or "skip what I've already seen."

Without an offset parameter, agent instructions that say "call the tool again with a larger range" (e.g., `daysAhead=60`) still return the same earliest results because the tool's query range always starts from the same origin point (e.g., today).

### Solution

Add an `offset` or `offsetDays` parameter to the tool's input schema that shifts the query window forward, skipping already-seen results. The agent can then call the tool with an offset to get the next page.

### Implementation pattern

```typescript
inputSchema: z.object({
  resourceId: z.number().int().positive(),
  daysAhead: z.number().int().min(1).max(60).default(30),
  offsetDays: z.number().int().min(0).max(365).default(0)
    .describe('How many days to skip (for "later" requests)'),
}),
execute: async ({ resourceId, daysAhead, offsetDays }) => {
  let startDate = todayMidnight + offsetDays * MS_PER_DAY
  let endDate = startDate + daysAhead * MS_PER_DAY
  // query using [startDate, endDate) range
}
```

### Agent instructions

Tell the agent how to use the offset parameter:

```
- Wenn der Kunde nach SPÄTEREN Terminen fragt: Rufe find_next_available_slots erneut
  mit offsetDays auf den bereits gezeigten Zeitraum (z.B. offsetDays=30, daysAhead=30)
```

The tool description should also mention the offset parameter so the agent knows it exists:

```
Parameter: offsetDays (optional, Standard 0, maximal 365).
offsetDays gibt an, wie viele Tage ab heute übersprungen werden sollen
(z.B. offsetDays=30 für Termine ab Tag 31).
```

### Key design considerations

1. **Non-overlapping ranges**: The default and offset ranges must not overlap: default = `[today, today+daysAhead)`, offset = `[today+offsetDays, today+offsetDays+daysAhead)`
2. **Agent-facing description**: The parameter must be described in the tool description AND in agent instructions, since the agent needs to know when and how to use it
3. **Max bounds**: Set reasonable bounds (e.g., `max: 365`) so the agent can't query impossibly far ahead

---

## When to Use

- You have a Mastra agent with at least one destructive tool and want a hard (non-bypassable) approval gate
- Your agent calls use `agent.generate()` and you want to avoid refactoring to `stream()`
- Calling `approveToolCallGenerate`/`declineToolCallGenerate` through a variable reference
- The agent may call multiple `requireApproval` tools in a single run (sequential tool chaining)
- Multiple tools with `requireApproval: true` need different approval UI cards
- Any destructive agent tool that requires human confirmation before execution
- Creating a new `createTool` or debugging why an agent skips a tool call or asks the user for session/context data
- Any Mastra tool that returns time-bounded or paginated results where the agent should support "give me more" requests

## Related Skills

- `mastra-agent` — SSE streaming, askUserTool/requireApproval transport, tool result extraction
- `mastra-workflow` — Mastra Workflow resume/abort race and step type compatibility
- `remix-security-middleware` — CSRF protection for approval form endpoints
- `remix-session-flash-soft-fork` — `session.flash()` for one-time approval UI routing decisions
