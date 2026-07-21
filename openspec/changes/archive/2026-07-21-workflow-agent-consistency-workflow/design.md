## Context

The workflow agent currently has two modes — query (navigate + done) and workflow (navigate + ask_user + execute). The users grid at `/admin/users` handles display for both. After the admin interacts with the grid, there's no consistency feedback — e.g., "these locked users have pending appointments, you might want to address that."

Mastra workflows support `.parallel([step1, step2])` for executing steps concurrently. The agent can trigger a workflow via a tool. Existing patterns: `workflows/lock-user-workflow.ts`, `workflows/booking-workflow.ts`.

## Goals / Non-Goals

**Goals:**
- Single unified flow: navigate → ask_user("Ready?") → consistency check workflow → wait
- Consistency checks run after every user question (not for non-user questions)
- First check: list locked users with pending appointment counts
- Checks implemented as a Mastra Workflow with `.parallel()` for future extensibility
- The `ask_user` options include the admin's implied action alongside a "Ready" baseline

**Non-Goals:**
- Adding checks beyond locked-users-pending-appointments (the parallel structure is designed for it but this change only ships the first check)
- Changing the admin users grid
- Running checks for non-user questions

## Decisions

**Decision 1: Mastra Workflow with `.parallel()`, not agent tools.**
Using `createWorkflow` with `.parallel()` instead of individual agent `createTool` calls. Workflow steps run concurrently and can be extended by adding steps to the parallel array. The agent calls a single tool (`run_consistency_checks`) that triggers the workflow.

**Decision 2: Agent tool wraps the workflow.**
The agent tool `run_consistency_checks` calls `mastra.getWorkflow('consistencyCheckWorkflow').createRun().start()`. This keeps the agent's tool surface simple — one tool for all current and future checks.

**Decision 3: Unified flow replaces two-mode split.**
The previous design had separate query and workflow modes. Instead:
- Every user question → navigate to grid
- ask_user always includes a "Ready" option plus any action the admin's request implies
- After action executes (or admin clicks Ready), consistency workflow runs

**Decision 4: Check returns user list with counts.**
The `checkLockedUsersPendingAppointments` step queries:
```sql
SELECT u.id, u.name, u.email, count(a.id) AS pending_count
FROM users u LEFT JOIN appointments a ON a.user_id = u.id AND a.date >= now()
WHERE u.disabled_at IS NOT NULL
GROUP BY u.id, u.name, u.email
ORDER BY u.name
```
Returns list of `{id, name, email, pendingCount}`.

## Risks / Trade-offs

[Risk] Consistency workflow runs after every user question — could be slow if queries are heavy. Mitigation: Single focused query, DB indexes on `disabled_at` and `date`.

[Risk] `ask_user` with "Ready" adds an extra click. Mitigation: The "Ready" button is the only way to know the admin is done with the grid — there's no reliable DOM event for "user finished looking."
