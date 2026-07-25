---
name: mastra-tool-single-job-separation
description: "Design Mastra tools with one job each — separate lookup, confirmation, and execution into distinct tools"
origin: auto-extracted
---

# Mastra Tool Single-Job Separation

**Extracted:** 2026-07-24
**Context:** Designing agent tools for multi-step workflows where an action requires user verification before execution

## Problem

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

## Solution

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

## When to Use

- Any destructive agent tool that requires human confirmation before execution
- Multi-step workflows where the agent gathers data, shows it, waits, then acts
- When you notice a tool's `execute()` has an `if/else` branching on a boolean flag
- When agent instructions include rules like "carry X forward between calls" or "NEVER ask for Y again" — that's a sign your tools are forcing state management onto the agent
