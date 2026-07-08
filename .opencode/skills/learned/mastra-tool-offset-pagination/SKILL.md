---
name: mastra-tool-offset-pagination
description: "Add offset/offsetDays parameters to Mastra tools so agents can request more results without duplicates"
origin: auto-extracted
---

# Mastra Tool Offset Pagination for Agent "Show More" Requests

**Extracted:** 2026-07-08
**Context:** Building a Mastra agent tool that returns limited results (e.g., appointment slots) where the agent needs to support "show me more/later" requests

## Problem

When a Mastra agent tool returns a limited set of results (e.g., top 10 items, next 3 days of slots), the agent cannot request additional results without getting duplicates. Simply calling the tool again with the same parameters returns the same data. The agent has no way to say "give me the next page" or "skip what I've already seen."

Without an offset parameter, agent instructions that say "call the tool again with a larger range" (e.g., `daysAhead=60`) still return the same earliest results because the tool's query range always starts from the same origin point (e.g., today).

## Solution

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

## When to Use

- Any Mastra tool that returns time-bounded or paginated results where the agent should support "give me more" requests
- Tools that cap results (e.g., return top N items) where the agent needs pagination
- Not needed for tools that return all matching results in one call
