## Why

The workflow agent currently can only navigate to `/admin/users` and execute account management actions. When an admin asks about appointments ("what appointments does user 5 have", "appointments this week"), the agent says it has no tools for that — forcing the admin to switch to the support agent. The appointments grid at `/verwaltung/appointments` already supports text search (`filter`), period presets (`period`), and status filtering. The workflow agent should leverage this for appointment queries.

## What Changes

- Workflow agent gains the ability to recognize appointment-related questions and navigate to `/verwaltung/appointments` with appropriate `filter` and/or `period` query params
- Existing user account flow (navigate to `/admin/users` → ask_user → execute action → consistency checks) stays unchanged
- The agent uses the existing `navigate` tool — no new tool definitions needed
- Appointment navigation is a terminal step (agent navigates and waits for next question; no ask_user or consistency checks for appointment queries)

## Capabilities

### New Capabilities
- `workflow-agent-appointment-queries`: When the admin asks about appointments (by user, date range, period, status, etc.), the workflow agent navigates to `/verwaltung/appointments` with the appropriate filter, period, and/or status query params, then waits for the next question. This covers appointment lookups only — not user management actions.

### Modified Capabilities
<!-- none -->

## Impact

- `app/actions/mastra/agents/workflow-agent.ts` — modify agent instructions to add appointment query detection and navigation rules
- No new tools, no new routes, no controller changes
- Tests: update `app/actions/workflow-agent/controller.test.ts` and/or `app/actions/workflow-agent/workflow-agent.test.ts` to cover appointment navigation
