## Context

The workflow agent (`app/actions/mastra/agents/workflow-agent.ts`) has 6 tools: cancel, lock, unlock workflows, check_pending_appointments, ask_user, and navigate. Its instructions are rigid protocols for specific user IDs — no general query capability.

The admin users grid (`/admin/users`) supports `filter=disabled`, `filter=enabled`, and free-text search via `ilike(name/email)`. The `routeNavigate` tool already builds URLs with query params. The SSE pipeline (`workflow-agent-stream.tsx`) already handles `navigate` events to reload frames.

## Goals / Non-Goals

**Goals:**
- Workflow agent navigates to `/admin/users` for any user-related question
- Map natural language to filter params: locked/disabled → `filter=disabled`, active/enabled → `filter=enabled`, name/email text → `filter=<text>`
- Query-mode navigation does NOT call `ask_user` after navigating

**Non-Goals:**
- Adding new DB-query tools (the grid handles this)
- Changing the support agent or route agent
- Modifying the users grid itself

## Decisions

**Decision 1: Instructions-only change, no code.**
The `navigate` tool already supports `query` params. The grid already supports all filter modes. Only the agent's instructions need to change — a new "User Queries" section before the existing workflow protocols.

**Decision 2: Query mode vs workflow mode.**
Two distinct modes in the instructions:

```
Mode A — User Query (NEW):
  "which users are locked?" → navigate({path: '/admin/users', query: {filter: 'disabled'}})
  → DONE. No ask_user.

Mode B — Workflow (existing):
  "lock user 5" → cancel/lock/unlock workflow_v2 → navigate → ask_user → execute
```

The key distinction: if the admin mentions a specific user ID or action (lock/cancel/unlock), it's a workflow. Otherwise, it's a query.

**Decision 3: Free-text search uses the `filter` param.**
The grid's controller already does `ilike('name', '%text%') OR ilike('email', '%text%')` when `filter` is not `enabled`/`disabled`. So "find user named Smith" → `navigate({path: '/admin/users', query: {filter: 'Smith'}})` works with zero backend changes.

## Risks / Trade-offs

[Risk] Agent confuses query mode with workflow mode → navigates but then calls ask_user. Mitigation: Place query rules first in instructions, with explicit "do NOT call ask_user" statements.

[Risk] Agent doesn't recognize edge cases (e.g., "show me users created last week"). Mitigation: The grid doesn't support date-range filtering — if the query is too complex for the grid, the agent should say so and show the unfiltered grid.
