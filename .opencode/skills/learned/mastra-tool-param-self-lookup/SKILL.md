---
name: mastra-tool-param-self-lookup
description: "Look up tool parameters internally instead of requiring the LLM to pass them — prevents the agent from asking users for data"
user-invocable: false
origin: auto-extracted
---

# Mastra Tool Parameter Self-Lookup

**Extracted:** 2026-07-21
**Context:** When designing a `createTool` for a Mastra agent, tool parameters that require data the tool can query internally (current user, request context) force the LLM to ask the user — or, worse, the LLM confabulates values and skips the call.

## Problem

A Mastra agent tool has an `inputSchema` defining what parameters the LLM must provide. If the schema includes fields like `adminName` or `adminEmail`, the LLM must:

1. Know these values (it usually doesn't — they're session/context data, not conversation data)
2. Pass them when calling the tool

The result is one of three failure modes:

- **LLM asks the user**: "What is your name and email?" — terrible UX, makes the tool feel broken
- **LLM confabulates**: generates fake values and calls the tool with wrong data
- **LLM skips the tool**: mentions "PDF report was generated" in text without ever calling the underlying tool, because it lacks the required parameters

## Solution

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

## When to Use

- Creating a new `createTool` for a Mastra agent
- Reviewing existing tools that force the LLM to ask for session/context data
- Debugging why an agent skips a tool call or asks the user for obvious information
- Any tool whose `execute` function has access to `AsyncLocalStorage`, request context, or can query a database
