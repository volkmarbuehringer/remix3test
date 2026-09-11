# Tool Design

## What This Covers

Designing Mastra agent tools so the model can use them reliably. Read this when the task involves:

- A multi-step action (look up → confirm → execute) that tempts a single tool with a `confirmed` flag
- An agent asking the user for session/context data, confabulating it, or skipping a tool
- A time-bounded or paginated tool result that needs "show me more" support

For approval gating and suspension handling, see `approval-gating.md`.

## Single-Job Separation

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
2. **Conversation burden on the agent** — the agent must carry `confirmed=true` across tool calls in working memory. The instructions must say "NEVER ask the admin for the user ID again — you already have it" because the flow is fragile.
3. **Navigation happens after lookup** — the user only sees the grid *after* the tool already found the match. The lookup and the visual verification are decoupled, which causes the **"found but ask for ID" anti-pattern**: the agent finds the user, but instead of letting the user confirm visually, it asks for a technical identifier.

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

## Parameter Self-Lookup

A Mastra agent tool has an `inputSchema` defining what parameters the LLM must provide. If the schema includes fields like `adminName` or `adminEmail`, the LLM must:

1. Know these values (it usually doesn't — they're session/context data, not conversation data)
2. Pass them when calling the tool

The result is one of three failure modes:

- **LLM asks the user**: "What is your name and email?" — terrible UX, makes the tool feel broken
- **LLM confabulates**: generates fake values and calls the tool with wrong data
- **LLM skips the tool**: mentions "PDF report was generated" in text without ever calling the underlying tool, because it lacks the required parameters

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

## Offset Pagination for Agent "Show More" Requests

When a Mastra agent tool returns a limited set of results (e.g., top 10 items, next 3 days of slots), the agent cannot request additional results without getting duplicates. Simply calling the tool again with the same parameters returns the same data. The agent has no way to say "give me the next page" or "skip what I've already seen."

Without an offset parameter, agent instructions that say "call the tool again with a larger range" (e.g., `daysAhead=60`) still return the same earliest results because the tool's query range always starts from the same origin point (e.g., today).

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
